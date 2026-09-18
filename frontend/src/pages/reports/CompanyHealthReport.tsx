import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { companyHealthApi, CompanyHealthNarrative } from '../../services/companyHealth';
import { rolling12ReportApi } from '../../services/rolling12Report';
import { pmWorkloadReportApi } from '../../services/pmWorkloadReport';
import { backlogAnalysisApi, BacklogAnalysisData } from '../../services/backlogAnalysis';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend);

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtM = (v: number) => {
  if (v === 0) return '$0';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${v < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${v < 0 ? '-' : ''}$${(abs / 1_000).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
};

const fmtPct = (v: number | string | null | undefined) => {
  const n = parseFloat(v as string);
  return isNaN(n) ? '—' : `${n.toFixed(1)}%`;
};

// ── Shared chart options ───────────────────────────────────────────────────────

const fmtTick = (v: number | string) => typeof v === 'number' ? fmtM(v) : String(v);

const horizBarOpts = (maxVal?: number) => ({
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { color: '#f1f5f9' },
      ticks: { font: { size: 10 }, callback: fmtTick },
      max: maxVal,
    },
    y: { grid: { display: false }, ticks: { font: { size: 11 } } },
  },
});

const stackedBarOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { font: { size: 11 }, boxWidth: 12 } },
    tooltip: {
      callbacks: {
        label: (ctx: any) => ` ${ctx.dataset.label}: ${fmtM(ctx.raw)}`,
      },
    },
  },
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
    y: { stacked: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, callback: fmtTick } },
  },
};

// ── Components ────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{ label: string; value: string; sub?: string; accent?: string; link?: string }> = ({
  label, value, sub, accent = '#1a2b4a', link,
}) => {
  const inner = (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '1rem 1.25rem', borderTop: `3px solid ${accent}`,
      flex: 1, minWidth: 0,
      textDecoration: 'none', color: 'inherit', display: 'block',
    }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  );
  return link ? <Link to={link} style={{ flex: 1, minWidth: 0, display: 'contents' }}>{inner}</Link> : inner;
};

const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  title, subtitle, children, action,
}) => (
  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.25rem 1.5rem' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.1rem' }}>{subtitle}</div>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const NarrativeBox: React.FC<{ text?: string; loading?: boolean }> = ({ text, loading }) => {
  if (loading) return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: '0.82rem' }}>
      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Generating AI analysis…
    </div>
  );
  if (!text) return null;
  return (
    <div style={{ background: '#f0f4ff', border: '1px solid #c7d7ff', borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '1rem', fontSize: '0.83rem', color: '#1e293b', lineHeight: 1.65 }}>
      <span style={{ fontWeight: 600, color: '#1a2b4a', marginRight: 6 }}>AI Analysis:</span>{text}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const CompanyHealthReport: React.FC = () => {
  const [narrative, setNarrative] = useState<CompanyHealthNarrative | null>(null);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const { data: chRes, isLoading: chLoading, error: chError } = useQuery({
    queryKey: ['company-health'],
    queryFn: () => companyHealthApi.get().then(r => r.data),
  });

  const { data: r12 } = useQuery({
    queryKey: ['rolling-12-company-health'],
    queryFn: () => rolling12ReportApi.get().then(r => r.data),
  });

  const { data: pmWl } = useQuery({
    queryKey: ['pm-workload-company-health'],
    queryFn: () => pmWorkloadReportApi.getReport().then(r => r.data),
  });

  const { data: backlogAnalysis } = useQuery<BacklogAnalysisData>({
    queryKey: ['backlog-analysis-company-health'],
    queryFn: () => backlogAnalysisApi.getData(),
  });

  const narrativeMutation = useMutation({
    mutationFn: () => {
      const cashFlowSummary = {
        totalCashFlow: chRes?.kpis.total_cash_flow ?? 0,
        totalReceivables: chRes?.kpis.total_open_receivables ?? 0,
        positiveCfCount: chRes?.kpis.positive_cf_count ?? 0,
        totalProjects: chRes?.kpis.active_linked_count ?? 0,
      };
      return companyHealthApi.generateNarrative({
        kpis: chRes?.kpis,
        backlog_by_market: chRes?.backlog_by_market,
        market_breakdown: chRes?.market_breakdown,
        opps_by_stage: chRes?.opps_by_stage,
        dept_breakdown: chRes?.dept_breakdown,
        labor_forecast: chRes?.labor_forecast,
        rolling12: r12 ? { secured: r12.secured, awarded: r12.awarded, pursuits: r12.pursuits } : null,
        pmWorkload: pmWl ? { attention: pmWl.attention, pms: pmWl.pms } : null,
        cashFlowSummary,
        backlogAnalysis: backlogAnalysis ? {
          currentFYRevenue: backlogAnalysis.currentFYRevenue,
          futureFYRevenue: backlogAnalysis.futureFYRevenue,
          totalBacklogRevenue: backlogAnalysis.totalBacklogRevenue,
          totalBacklogGM: backlogAnalysis.totalBacklogGM,
          sgaMonthsCovered: backlogAnalysis.sgaMonthsCovered,
          monthlySgAndA: backlogAnalysis.monthlySgAndA,
          backlogSoldNotContracted: backlogAnalysis.backlogSoldNotContracted,
          highPotentialBacklog: backlogAnalysis.highPotentialBacklog,
          awardedNotInVistaCount: backlogAnalysis.awardedNotInVistaOpps.length,
          highPotentialCount: backlogAnalysis.highPotentialOpps.length,
          currentFY: backlogAnalysis.currentFY,
        } : null,
      }).then(r => r.data);
    },
    onSuccess: (data) => { setNarrative(data.narrative); setNarrativeError(null); },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'Unknown error';
      setNarrativeError(msg);
    },
  });

  // ── Derived data ─────────────────────────────────────────────────────────────

  const rolling12ChartData = useMemo(() => {
    if (!r12) return null;
    const cols = r12.columns;
    return {
      labels: cols.map(c => c.label),
      datasets: [
        {
          label: 'Secured',
          data: cols.map(c => r12.secured[c.key] || 0),
          backgroundColor: '#1a2b4a',
        },
        {
          label: 'Awarded',
          data: cols.map(c => r12.awarded[c.key] || 0),
          backgroundColor: '#10b981',
        },
        {
          label: 'Pursuits (weighted)',
          data: cols.map(c => r12.pursuits[c.key] || 0),
          backgroundColor: '#f59e0b',
        },
      ],
    };
  }, [r12]);

  const backlogChartData = useMemo(() => {
    const rows = chRes?.backlog_by_market ?? [];
    return {
      labels: rows.map(r => r.market),
      datasets: [{ data: rows.map(r => r.backlog), backgroundColor: '#1a2b4a', borderRadius: 4 }],
    };
  }, [chRes]);

  const oppsChartData = useMemo(() => {
    const rows = (chRes?.opps_by_stage ?? []).filter(r => r.count > 0);
    return {
      labels: rows.map(r => r.stage_name),
      datasets: [
        {
          label: 'Total Value',
          data: rows.map(r => r.total_value),
          backgroundColor: rows.map(r => r.stage_color || '#3b82f6'),
          borderRadius: 4,
        },
      ],
    };
  }, [chRes]);

  const laborMonthChart = useMemo(() => {
    const rows = chRes?.labor_forecast?.by_month ?? [];
    return {
      labels: rows.map(r => r.month_label),
      datasets: [
        { label: 'Plumber',    data: rows.map(r => r.pl ?? 0), backgroundColor: '#f59e0b', stack: 'labor', borderRadius: 1 },
        { label: 'Sheet Metal', data: rows.map(r => r.sm ?? 0), backgroundColor: '#8b5cf6', stack: 'labor', borderRadius: 1 },
        { label: 'Pipefitter',  data: rows.map(r => r.pf ?? 0), backgroundColor: '#3b82f6', stack: 'labor', borderRadius: 1 },
      ],
    };
  }, [chRes]);

  const laborTradeChart = useMemo(() => {
    const rows = chRes?.labor_forecast?.by_trade ?? [];
    return {
      labels: rows.map(r => r.trade),
      datasets: [
        { label: '0–6 mo', data: rows.map(r => r.h6), backgroundColor: '#1a2b4a', borderRadius: 3 },
        { label: '6–12 mo', data: rows.map(r => r.h12), backgroundColor: '#3b82f6', borderRadius: 3 },
        { label: '12–18 mo', data: rows.map(r => r.h18), backgroundColor: '#8b5cf6', borderRadius: 3 },
      ],
    };
  }, [chRes]);

  const gmTrendChart = useMemo(() => {
    const historical = chRes?.gm_trend ?? [];
    const backlogGm = chRes?.kpis?.backlog_gm_pct ?? null;

    const now = new Date();
    const futureMonths: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      futureMonths.push(d.toLocaleString('en-US', { month: 'short' }) + " '" + String(d.getFullYear()).slice(2));
    }

    const histLabels = historical.map(r => r.month_label);
    const histValues = historical.map(r => parseFloat(String(r.gm_pct)));
    const lastHist = histValues.length ? histValues[histValues.length - 1] : backlogGm;
    const allLabels = [...histLabels, ...futureMonths];

    // Solid line covers history; nulls for future slots
    const solidData: (number | null)[] = [...histValues, ...futureMonths.map(() => null)];

    // Dashed line: nulls until the last historical slot (bridge point), then projects forward
    const dashedData: (number | null)[] = [
      ...histLabels.slice(0, -1).map(() => null),
      lastHist,
      ...(backlogGm != null ? futureMonths.map(() => backlogGm) : futureMonths.map(() => null)),
    ];

    const allNums = [...histValues, ...(backlogGm != null ? [backlogGm] : [])].filter((v): v is number => v != null);
    const min = allNums.length ? Math.max(0, Math.min(...allNums) - 3) : 0;
    const max = allNums.length ? Math.max(...allNums) + 3 : 30;

    return {
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Actual GM%',
            data: solidData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#10b981',
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'Projected (Backlog GM%)',
            data: dashedData,
            borderColor: '#3b82f6',
            backgroundColor: 'transparent',
            borderDash: [5, 4],
            tension: 0.1,
            fill: false,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'bottom' as const, labels: { font: { size: 10 }, boxWidth: 10 } },
          tooltip: {
            callbacks: {
              label: (ctx: any) => ` ${ctx.dataset.label}: ${Number(ctx.raw).toFixed(1)}%`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } },
          y: {
            min, max,
            grid: { color: '#f1f5f9' },
            ticks: { font: { size: 10 }, callback: (v: number | string) => `${Number(v).toFixed(1)}%` },
          },
        },
      },
    };
  }, [chRes]);

  const pmCounts = useMemo(() => {
    if (!pmWl) return null;
    const overloaded = pmWl.attention.overloaded.length;
    const sideways = pmWl.attention.sideways.length;
    const available = pmWl.attention.available.length;
    const healthy = pmWl.pms.length - overloaded - sideways - available;
    return { overloaded, sideways, available, healthy, total: pmWl.pms.length };
  }, [pmWl]);


  // ── Render ────────────────────────────────────────────────────────────────────

  if (chLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#64748b' }}>
      Loading Company Health…
    </div>
  );

  if (chError || !chRes) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: '#ef4444' }}>
      Failed to load company health data.
    </div>
  );

  const kpis = chRes.kpis;
  const labor = chRes.labor_forecast;
  const ls = chRes.labor_summary;

  const asOf = chRes.as_of ? new Date(chRes.as_of).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Today';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link to="/reports" style={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none', display: 'block', marginBottom: '0.4rem' }}>
            &larr; Reports
          </Link>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#1e293b' }}>Company Health</h1>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>Snapshot as of {asOf}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => narrativeMutation.mutate()}
            disabled={narrativeMutation.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: narrativeMutation.isPending ? '#e2e8f0' : '#1a2b4a', color: '#fff',
              border: 'none', borderRadius: 7, padding: '0.55rem 1rem', fontWeight: 600,
              fontSize: '0.82rem', cursor: narrativeMutation.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            <AutoAwesomeIcon style={{ fontSize: '1rem' }} />
            {narrativeMutation.isPending ? 'Generating…' : narrative ? 'Regenerate Analysis' : 'Generate AI Analysis'}
          </button>
          <button
            onClick={async () => {
              setPdfLoading(true);
              setPdfError(null);
              try {
                await companyHealthApi.downloadPdf(
                  narrative,
                  r12 ? { columns: r12.columns, secured: r12.secured, awarded: r12.awarded, pursuits: r12.pursuits } : null,
                  pmWl ? {
                    counts: {
                      overloaded: pmWl.attention.overloaded.length,
                      sideways:   pmWl.attention.sideways.length,
                      available:  pmWl.attention.available.length,
                      healthy:    pmWl.pms.length - pmWl.attention.overloaded.length - pmWl.attention.sideways.length - pmWl.attention.available.length,
                      total:      pmWl.pms.length,
                    },
                    overloaded: pmWl.attention.overloaded.slice(0, 6).map((pm: any) => ({
                      pmName: pm.pmName,
                      activeProjects: pm.activeProjects,
                      backlogDollars: pm.backlogDollars,
                    })),
                  } : null,
                  backlogAnalysis ? {
                    currentFY:                backlogAnalysis.currentFY,
                    currentFYRevenue:         backlogAnalysis.currentFYRevenue,
                    futureFYRevenue:          backlogAnalysis.futureFYRevenue,
                    totalBacklogGM:           backlogAnalysis.totalBacklogGM,
                    totalBacklogRevenue:      backlogAnalysis.totalBacklogRevenue,
                    sgaMonthsCovered:         backlogAnalysis.sgaMonthsCovered,
                    monthlySgAndA:            backlogAnalysis.monthlySgAndA,
                    backlogSoldNotContracted: backlogAnalysis.backlogSoldNotContracted,
                    awardedNotInVistaCount:   backlogAnalysis.awardedNotInVistaOpps.length,
                    highPotentialBacklog:     backlogAnalysis.highPotentialBacklog,
                    highPotentialCount:       backlogAnalysis.highPotentialOpps.length,
                  } : null,
                );
              } catch (err: any) {
                const msg = err?.response?.data?.error || err?.message || 'PDF generation failed';
                setPdfError(msg);
              } finally {
                setPdfLoading(false);
              }
            }}
            disabled={pdfLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#fff', color: '#1a2b4a', border: '1px solid #e2e8f0',
              borderRadius: 7, padding: '0.55rem 1rem', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
            }}
          >
            <PictureAsPdfIcon style={{ fontSize: '1rem' }} />
            {pdfLoading ? 'Generating PDF…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* PDF error */}
      {pdfError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#991b1b' }}>
          <strong>PDF generation failed:</strong> {pdfError}
        </div>
      )}

      {/* AI error */}
      {narrativeError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#991b1b' }}>
          <strong>AI Analysis failed:</strong> {narrativeError}
        </div>
      )}

      {/* AI Overview */}
      {(narrative?.overview || narrativeMutation.isPending) && (
        <div style={{ background: 'linear-gradient(135deg, #1a2b4a 0%, #2d4a8a 100%)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
            <AutoAwesomeIcon style={{ fontSize: '1.1rem', color: '#f97316' }} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Executive Summary</span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: 'auto' }}>AI-generated analysis</span>
          </div>
          {narrativeMutation.isPending ? (
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Analyzing company data…</div>
          ) : (
            <div style={{ fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-line', color: '#e2e8f0' }}>
              {narrative?.overview}
            </div>
          )}
        </div>
      )}

      {/* Top KPIs */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <KpiCard label="Active Projects" value={kpis.active_projects.toString()} accent="#1a2b4a" link="/projects" />
        <KpiCard label="Total Backlog" value={fmtM(kpis.total_backlog)} sub={`6mo: ${fmtM(kpis.backlog_6mo)}`} accent="#f97316" link="/reports/backlog-fit" />
        <KpiCard label="Avg GM%" value={fmtPct(kpis.avg_gm_pct)} sub={`GP: ${fmtM(kpis.total_gross_profit)}`} accent="#10b981" link="/reports/cash-flow" />
        <KpiCard label="Cash Flow" value={fmtM(kpis.total_cash_flow)} accent={kpis.total_cash_flow >= 0 ? '#10b981' : '#ef4444'} link="/reports/cash-flow" />
        <KpiCard label="Pipeline" value={fmtM(kpis.total_pipeline_value)} sub={`${kpis.total_opps_count} opps · weighted ${fmtM(kpis.weighted_pipeline)}`} accent="#3b82f6" link="/opportunities" />
        <KpiCard label="Contract Value" value={fmtM(kpis.total_contract_value)} accent="#8b5cf6" link="/reports/executive-report" />
      </div>

      {/* Revenue Forecast + Backlog */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <Section
          title="Revenue Forecast — Rolling 12 Months"
          subtitle="Secured revenue + awarded/pursuit opportunities by month"
          action={<Link to="/reports/rolling-12" style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none' }}>Full report →</Link>}
        >
          <NarrativeBox text={narrative?.backlog} loading={narrativeMutation.isPending} />
          {rolling12ChartData ? (
            <div style={{ height: 240 }}>
              <Bar data={rolling12ChartData} options={stackedBarOpts} />
            </div>
          ) : (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>Loading revenue data…</div>
          )}
        </Section>

        <Section
          title="Backlog by Market"
          subtitle="Current backlog — active projects"
          action={<Link to="/reports/backlog-fit" style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none' }}>Backlog Fit →</Link>}
        >
          {chRes.backlog_by_market.length > 0 ? (
            <div style={{ height: 240 }}>
              <Bar data={backlogChartData} options={horizBarOpts()} />
            </div>
          ) : (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>No backlog data</div>
          )}
        </Section>
      </div>

      {/* Pipeline + Project Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <Section
          title="Pipeline by Stage"
          subtitle="Open opportunities by pipeline stage — total estimated value"
          action={<Link to="/opportunities" style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none' }}>View Pipeline →</Link>}
        >
          <NarrativeBox text={narrative?.pipeline} loading={narrativeMutation.isPending} />
          {chRes.opps_by_stage.some(r => r.count > 0) ? (
            <div style={{ height: 220 }}>
              <Bar data={oppsChartData} options={horizBarOpts()} />
            </div>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>No pipeline data</div>
          )}
        </Section>

        <Section title="GM% Trend" subtitle="Weighted gross margin % — last 6 months">
          {gmTrendChart.data.labels.length > 0 ? (
            <div style={{ height: 220 }}>
              <Line data={gmTrendChart.data} options={gmTrendChart.options as any} />
            </div>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>No snapshot data</div>
          )}
        </Section>
      </div>

      {/* Financial Health + PM Workload */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <Section
          title="Financial Health"
          subtitle="Cash flow and receivables across active projects"
          action={<Link to="/reports/cash-flow" style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none' }}>Cash Flow Report →</Link>}
        >
          <NarrativeBox text={narrative?.financial} loading={narrativeMutation.isPending} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Net Cash Flow', value: fmtM(kpis.total_cash_flow), sub: undefined as string | undefined, accent: kpis.total_cash_flow >= 0 ? '#10b981' : '#ef4444' },
              { label: 'Open Receivables', value: fmtM(kpis.total_open_receivables), sub: undefined, accent: '#f97316' },
              { label: 'Avg Gross Margin', value: fmtPct(kpis.avg_gm_pct), sub: undefined, accent: '#10b981' },
              { label: 'GM in Backlog', value: fmtPct(kpis.backlog_gm_pct), sub: undefined, accent: '#8b5cf6' },
              { label: 'Projects w/ Positive CF', value: `${kpis.positive_cf_count} / ${kpis.active_linked_count}`, sub: undefined, accent: '#3b82f6' },
              {
                label: 'CF+ Jobs >15% Complete',
                value: kpis.over15_count > 0
                  ? `${kpis.cf_positive_over15_count} / ${kpis.over15_count} (${Math.round(kpis.cf_positive_over15_count / kpis.over15_count * 100)}%)`
                  : '—',
                sub: undefined,
                accent: '#f59e0b',
              },
              {
                label: 'Avg % Comp at CF+',
                value: kpis.projects_that_turned_positive > 0
                  ? `${kpis.avg_pct_at_first_positive.toFixed(0)}%`
                  : '—',
                sub: kpis.projects_that_turned_positive > 0
                  ? `${kpis.projects_that_turned_positive} jobs historically`
                  : undefined,
                accent: '#1a2b4a',
              },
            ].map(item => (
              <div key={item.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '0.85rem 1rem', borderLeft: `3px solid ${item.accent}` }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{item.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{item.value}</div>
                {item.sub && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>{item.sub}</div>}
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="PM Workload"
          subtitle="Project manager capacity and overload signals"
          action={<Link to="/reports/pm-workload" style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none' }}>Full Report →</Link>}
        >
          <NarrativeBox text={narrative?.pmWorkload} loading={narrativeMutation.isPending} />
          {pmCounts ? (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Overloaded', count: pmCounts.overloaded, color: '#ef4444', bg: '#fef2f2' },
                  { label: 'At Risk', count: pmCounts.sideways, color: '#f59e0b', bg: '#fffbeb' },
                  { label: 'Healthy', count: pmCounts.healthy, color: '#10b981', bg: '#ecfdf5' },
                  { label: 'Available', count: pmCounts.available, color: '#3b82f6', bg: '#eff6ff' },
                ].map(b => (
                  <div key={b.label} style={{
                    flex: 1, minWidth: 80, background: b.bg, borderRadius: 8,
                    padding: '0.65rem 0.75rem', textAlign: 'center', border: `1px solid ${b.color}22`,
                  }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: b.color }}>{b.count}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{b.label}</div>
                  </div>
                ))}
              </div>
              {pmWl?.attention.overloaded.length ? (
                <div style={{ fontSize: '0.78rem' }}>
                  <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: '0.35rem' }}>Overloaded PMs</div>
                  {pmWl.attention.overloaded.slice(0, 4).map(pm => (
                    <div key={pm.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                      <span>{pm.pmName}</span>
                      <span style={{ color: '#64748b' }}>{pm.activeProjects} jobs · {fmtM(pm.backlogDollars)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 500 }}>All PMs within capacity</div>
              )}
            </>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Loading workload data…</div>
          )}
        </Section>
      </div>

      {/* Backlog Analysis */}
      {backlogAnalysis && (
        <div style={{ marginBottom: '1rem' }}>
          <Section
            title="Backlog Analysis"
            subtitle={`FY${backlogAnalysis.currentFY} revenue & GM forecast from contracted backlog`}
            action={<Link to="/reports/backlog-analysis" style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none' }}>Full Report →</Link>}
          >
            <NarrativeBox text={narrative?.backlogAnalysis} loading={narrativeMutation.isPending} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              {[
                { label: `Current FY Revenue`, value: fmtM(backlogAnalysis.currentFYRevenue), accent: '#1a2b4a' },
                { label: 'Future FY Revenue', value: fmtM(backlogAnalysis.futureFYRevenue), accent: '#3b82f6' },
                { label: 'Total Backlog GM$', value: fmtM(backlogAnalysis.totalBacklogGM), accent: '#10b981' },
                {
                  label: 'Backlog GM%',
                  value: backlogAnalysis.totalBacklogRevenue > 0
                    ? `${(backlogAnalysis.totalBacklogGM / backlogAnalysis.totalBacklogRevenue * 100).toFixed(1)}%`
                    : '—',
                  accent: '#8b5cf6',
                },
              ].map(item => (
                <div key={item.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '0.85rem 1rem', borderLeft: `3px solid ${item.accent}` }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{item.label}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {[
                {
                  label: 'SGA Coverage',
                  value: backlogAnalysis.sgaMonthsCovered != null
                    ? `${backlogAnalysis.sgaMonthsCovered.toFixed(1)} months`
                    : '—',
                  sub: backlogAnalysis.monthlySgAndA > 0 ? `${fmtM(backlogAnalysis.monthlySgAndA)}/mo` : undefined,
                  accent: backlogAnalysis.sgaMonthsCovered != null && backlogAnalysis.sgaMonthsCovered >= 12 ? '#10b981' : '#f97316',
                },
                {
                  label: 'Sold Not Contracted',
                  value: fmtM(backlogAnalysis.backlogSoldNotContracted),
                  sub: `${backlogAnalysis.awardedNotInVistaOpps.length} opportunities`,
                  accent: '#f97316',
                },
                {
                  label: 'High Potential',
                  value: fmtM(backlogAnalysis.highPotentialBacklog),
                  sub: `${backlogAnalysis.highPotentialOpps.length} opportunities`,
                  accent: '#3b82f6',
                },
              ].map(item => (
                <div key={item.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '0.85rem 1rem', borderLeft: `3px solid ${item.accent}` }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{item.label}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{item.value}</div>
                  {item.sub && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>{item.sub}</div>}
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Labor Forecast */}
      <Section
        title="Labor Forecast"
        subtitle="Assigned headcount across the next 18 months"
        action={<Link to="/projects/labor-forecast" style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none' }}>Labor Board →</Link>}
      >
        <NarrativeBox text={narrative?.labor} loading={narrativeMutation.isPending} />

        {/* Current labor stats */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Total Employees', value: ls.total_employees },
            { label: 'Assigned', value: ls.currently_assigned },
            { label: 'Upcoming', value: ls.upcoming_assignments },
            { label: 'Ending in 2 Wks', value: ls.ending_within_two_weeks },
            { label: 'Unfilled Roles', value: ls.unfilled_roles },
            { label: 'Peak 0–6 Mo', value: `${labor.horizons.h6} workers` },
            { label: 'Peak 6–12 Mo', value: `${labor.horizons.h12} workers` },
            { label: 'Peak 12–18 Mo', value: `${labor.horizons.h18} workers` },
          ].map(s => (
            <div key={s.label} style={{
              flex: '1 1 100px', background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 8, padding: '0.65rem 0.85rem',
            }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>{s.label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Company Headcount — 18-Month Outlook</div>
            <div style={{ height: 200 }}>
              <Bar data={laborMonthChart} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { display: true, position: 'bottom' as const, labels: { font: { size: 10 }, boxWidth: 10 } },
                },
                scales: {
                  x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } },
                  y: { stacked: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, stepSize: 1 } },
                },
              }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>Headcount by Trade (6 / 12 / 18 mo)</div>
            <div style={{ height: 200 }}>
              <Bar data={laborTradeChart} options={{
                indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10 } } },
                scales: {
                  x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, stepSize: 1 } },
                  y: { grid: { display: false }, ticks: { font: { size: 11 } } },
                },
              }} />
            </div>
          </div>
        </div>
      </Section>

      {/* Department Breakdown + Market Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
        <Section
          title="Department Breakdown"
          subtitle="Active projects by department — backlog, gross margin, and profitability"
        >
          {chRes.dept_breakdown.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    {['Dept #', 'Department Name', 'Projects', 'Backlog', 'Gross Profit', 'GM%'].map(h => (
                      <th key={h} style={{
                        textAlign: h === 'Dept #' || h === 'Department Name' ? 'left' : 'right',
                        padding: '0.5rem 0.6rem',
                        fontWeight: 600, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chRes.dept_breakdown.map((d, i) => {
                    const gm = parseFloat(d.gm_pct as unknown as string);
                    const gmColor = isNaN(gm) ? '#94a3b8' : gm >= 20 ? '#10b981' : gm >= 10 ? '#f59e0b' : '#ef4444';
                    return (
                      <tr key={`${d.department_number}-${d.group_name}`} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '0.5rem 0.6rem', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>{d.department_number || '—'}</td>
                        <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600, color: '#1e293b' }}>{d.group_name}</td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: '#64748b' }}>{d.project_count}</td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 500 }}>{fmtM(d.backlog)}</td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>{fmtM(d.gross_profit)}</td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700, color: gmColor }}>{fmtPct(d.gm_pct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No department data available</div>
          )}
        </Section>

        <Section
          title="Market Breakdown"
          subtitle="Active projects by market segment — backlog, gross margin, and profitability"
        >
          {(chRes.market_breakdown ?? []).length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    {['Market', 'Projects', 'Backlog', 'Gross Profit', 'GM%'].map(h => (
                      <th key={h} style={{
                        textAlign: h === 'Market' ? 'left' : 'right',
                        padding: '0.5rem 0.6rem',
                        fontWeight: 600, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(chRes.market_breakdown ?? []).map((m, i) => {
                    const gm = parseFloat(m.gm_pct as unknown as string);
                    const gmColor = isNaN(gm) ? '#94a3b8' : gm >= 20 ? '#10b981' : gm >= 10 ? '#f59e0b' : '#ef4444';
                    return (
                      <tr key={m.market} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600, color: '#1e293b' }}>{m.market}</td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: '#64748b' }}>{m.project_count}</td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 500 }}>{fmtM(m.backlog)}</td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>{fmtM(m.gross_profit)}</td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700, color: gmColor }}>{fmtPct(m.gm_pct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No market data available</div>
          )}
        </Section>
      </div>
    </div>
  );
};

export default CompanyHealthReport;
