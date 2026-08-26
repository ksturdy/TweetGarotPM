import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { companyHealthApi, CompanyHealthNarrative } from '../../services/companyHealth';
import { rolling12ReportApi } from '../../services/rolling12Report';
import { pmWorkloadReportApi } from '../../services/pmWorkloadReport';
import { cashFlowReportApi } from '../../services/cashFlowReport';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

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

  const { data: cashFlow } = useQuery({
    queryKey: ['cash-flow-company-health'],
    queryFn: () => cashFlowReportApi.getData(),
  });

  const narrativeMutation = useMutation({
    mutationFn: () => {
      const cashFlowSummary = {
        totalCashFlow: cashFlow?.reduce((s, p) => s + (p.cash_flow || 0), 0) ?? 0,
        totalReceivables: cashFlow?.reduce((s, p) => s + (p.open_receivables || 0), 0) ?? 0,
        positiveCfCount: cashFlow?.filter(p => (p.cash_flow || 0) > 0).length ?? 0,
        totalProjects: cashFlow?.length ?? 0,
      };
      return companyHealthApi.generateNarrative({
        kpis: chRes?.kpis,
        backlog_by_market: chRes?.backlog_by_market,
        opps_by_stage: chRes?.opps_by_stage,
        dept_breakdown: chRes?.dept_breakdown,
        labor_forecast: chRes?.labor_forecast,
        rolling12: r12 ? { secured: r12.secured, awarded: r12.awarded, pursuits: r12.pursuits } : null,
        pmWorkload: pmWl ? { attention: pmWl.attention, pms: pmWl.pms } : null,
        cashFlowSummary,
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
          backgroundColor: '#3b82f6',
        },
        {
          label: 'Pursuits (weighted)',
          data: cols.map(c => r12.pursuits[c.key] || 0),
          backgroundColor: '#c7d7ff',
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
      datasets: [{
        label: 'Headcount',
        data: rows.map(r => r.total_headcount),
        backgroundColor: rows.map(r =>
          r.month_offset < 6 ? '#1a2b4a' : r.month_offset < 12 ? '#3b82f6' : '#8b5cf6'
        ),
        borderRadius: 2,
      }],
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

  const projectStatusChart = useMemo(() => {
    const rows = chRes?.project_status_dist ?? [];
    const colors: Record<string, string> = {
      Open: '#1a2b4a', 'Soft-Closed': '#10b981', 'Hard-Closed': '#64748b',
      completed: '#94a3b8', cancelled: '#ef4444',
    };
    return {
      labels: rows.map(r => r.status),
      datasets: [{
        data: rows.map(r => r.count),
        backgroundColor: rows.map(r => colors[r.status] || '#64748b'),
        borderWidth: 0,
      }],
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

  const cashFlowSummary = useMemo(() => {
    if (!cashFlow?.length) return null;
    const total = cashFlow.reduce((s, p) => s + (p.cash_flow || 0), 0);
    const receivables = cashFlow.reduce((s, p) => s + (p.open_receivables || 0), 0);
    const positive = cashFlow.filter(p => (p.cash_flow || 0) > 0).length;
    const avgGm = cashFlow.reduce((s, p) => s + (p.gross_profit_percent || 0), 0) / cashFlow.length;
    return { total, receivables, positive, total_projects: cashFlow.length, avgGm };
  }, [cashFlow]);

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

  const asOf = chRes.as_of ? new Date(chRes.as_of + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Today';

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
            onClick={async () => { setPdfLoading(true); try { await companyHealthApi.downloadPdf(); } finally { setPdfLoading(false); } }}
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

        <Section title="Project Status Mix">
          {projectStatusChart.labels.length > 0 ? (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Doughnut
                data={projectStatusChart}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } },
                  cutout: '60%',
                }}
              />
            </div>
          ) : null}
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
          {cashFlowSummary ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                { label: 'Net Cash Flow', value: fmtM(cashFlowSummary.total), accent: cashFlowSummary.total >= 0 ? '#10b981' : '#ef4444' },
                { label: 'Open Receivables', value: fmtM(cashFlowSummary.receivables), accent: '#f97316' },
                { label: 'Projects w/ Positive CF', value: `${cashFlowSummary.positive} / ${cashFlowSummary.total_projects}`, accent: '#3b82f6' },
                { label: 'Avg Gross Margin', value: fmtPct(cashFlowSummary.avgGm), accent: '#10b981' },
              ].map(item => (
                <div key={item.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '0.85rem 1rem', borderLeft: `3px solid ${item.accent}` }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{item.label}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>{item.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Loading cash flow data…</div>
          )}
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
                plugins: { legend: { display: false } },
                scales: {
                  x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45 } },
                  y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, stepSize: 1 } },
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

      {/* Department Breakdown */}
      <div style={{ marginTop: '1rem' }}>
        <Section
          title="Department / Market Breakdown"
          subtitle="Active projects by group — backlog, gross margin, and profitability"
        >
          {chRes.dept_breakdown.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    {['Group', 'Projects', 'Backlog', 'Gross Profit', 'GM%'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Group' ? 'left' : 'right', padding: '0.5rem 0.75rem', fontWeight: 600, color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chRes.dept_breakdown.map((d, i) => {
                    const gm = parseFloat(d.gm_pct as unknown as string);
                    const gmColor = isNaN(gm) ? '#94a3b8' : gm >= 20 ? '#10b981' : gm >= 10 ? '#f59e0b' : '#ef4444';
                    return (
                      <tr key={d.group_name} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600, color: '#1e293b' }}>{d.group_name}</td>
                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: '#64748b' }}>{d.project_count}</td>
                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 500 }}>{fmtM(d.backlog)}</td>
                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right' }}>{fmtM(d.gross_profit)}</td>
                        <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, color: gmColor }}>{fmtPct(d.gm_pct)}</td>
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
      </div>
    </div>
  );
};

export default CompanyHealthReport;
