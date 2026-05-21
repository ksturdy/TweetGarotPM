import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import EngineeringIcon from '@mui/icons-material/Engineering';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import { format } from 'date-fns';
import {
  pmReportApi,
  PMReportRow,
  PMReportJob,
  HealthLevel,
  PMReportTrend,
} from '../../services/pmReport';
import SearchableMultiSelect from '../../components/SearchableMultiSelect';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const fmt$ = (n: number) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000).toLocaleString('en-US')}K`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
};
const fmt$Full = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtPct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;

const HEALTH_META: Record<HealthLevel, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  green: { label: 'Healthy', color: '#15803d', bg: '#f0fdf4', border: '#86efac', icon: <CheckCircleOutlineIcon style={{ fontSize: '1rem' }} /> },
  yellow: { label: 'Watch', color: '#b45309', bg: '#fffbeb', border: '#fcd34d', icon: <WarningAmberIcon style={{ fontSize: '1rem' }} /> },
  red: { label: 'At Risk', color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', icon: <ErrorOutlineIcon style={{ fontSize: '1rem' }} /> },
};

const HealthPill: React.FC<{ level: HealthLevel; compact?: boolean }> = ({ level, compact }) => {
  const m = HEALTH_META[level];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
        background: m.bg, color: m.color, border: `1px solid ${m.border}`,
        padding: compact ? '0.1rem 0.4rem' : '0.2rem 0.55rem',
        borderRadius: '999px',
        fontSize: compact ? '0.65rem' : '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      }}
    >
      {m.icon}{m.label}
    </span>
  );
};

const Delta: React.FC<{ value: number | null; format?: 'money' | 'pp'; positiveIsGood?: boolean }> = ({ value, format = 'money', positiveIsGood = true }) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span style={{ color: '#94a3b8' }}>—</span>;
  }
  const isFlat = Math.abs(value) < (format === 'pp' ? 0.05 : 1);
  const isUp = value > 0;
  const color = isFlat ? '#64748b' : (isUp === positiveIsGood ? '#15803d' : '#b91c1c');
  const Icon = isFlat ? TrendingFlatIcon : (isUp ? TrendingUpIcon : TrendingDownIcon);
  const str = format === 'pp' ? `${value > 0 ? '+' : ''}${value.toFixed(2)}pp` : `${value > 0 ? '+' : '-'}${fmt$(Math.abs(value))}`;
  return (
    <span style={{ color, display: 'inline-flex', alignItems: 'center', gap: '0.15rem', fontWeight: 600 }}>
      <Icon style={{ fontSize: '0.9rem' }} />{str}
    </span>
  );
};

const Sparkline: React.FC<{ trend: PMReportTrend; field: 'projectedCost' | 'grossProfitPct' | 'backlog' | 'cashFlow' }> = ({ trend, field }) => {
  const data = useMemo(() => ({
    labels: trend.series.map(s => format(new Date(String(s.date).slice(0, 10) + 'T00:00:00'), 'M/d')),
    datasets: [{
      data: trend.series.map(s => s[field] as number),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
      fill: true,
    }],
  }), [trend, field]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: { x: { display: false }, y: { display: false } },
    elements: { line: { borderJoinStyle: 'round' as const } },
  }), []);

  return (
    <div style={{ height: '32px', width: '100px' }}>
      <Line data={data} options={options} />
    </div>
  );
};

const JobRow: React.FC<{ job: PMReportJob }> = ({ job }) => {
  const wow = job.trend?.weekOverWeek;
  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
      <td style={{ padding: '0.4rem 0.6rem' }}>
        <HealthPill level={job.health} compact />
      </td>
      <td style={{ padding: '0.4rem 0.6rem' }}>
        <div style={{ fontWeight: 600, color: '#0f172a' }}>
          {job.projectId ? (
            <Link to={`/projects/${job.projectId}/financials`} style={{ color: '#2563eb', textDecoration: 'none' }}>
              {job.contractNumber}
            </Link>
          ) : job.contractNumber}
        </div>
        <div style={{ color: '#64748b', fontSize: '0.7rem', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {job.description || '—'}
        </div>
      </td>
      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>{fmt$(job.contractAmount)}</td>
      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>{fmtPct(job.pctComplete * 100)}</td>
      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: job.grossProfitPercent < job.originalEstimatedMarginPct ? '#b91c1c' : '#15803d', fontWeight: 600 }}>
        {fmtPct(job.grossProfitPercent)}
        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 400 }}>orig {fmtPct(job.originalEstimatedMarginPct)}</div>
      </td>
      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: job.costVariance > 0.05 ? '#b91c1c' : job.costVariance > 0 ? '#b45309' : '#15803d', fontWeight: 600 }}>
        {fmtPct(job.costVariance * 100)}
      </td>
      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: job.overUnderBilled < 0 ? '#b91c1c' : job.overUnderBilled > 0 ? '#0891b2' : '#64748b' }}>
        {fmt$(job.overUnderBilled)}
      </td>
      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>{fmt$(job.backlog)}</td>
      <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: job.cashFlow < 0 ? '#b91c1c' : '#15803d' }}>{fmt$(job.cashFlow)}</td>
      <td style={{ padding: '0.4rem 0.6rem' }}>
        {job.trend ? <Sparkline trend={job.trend} field="grossProfitPct" /> : <span style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>no snapshots</span>}
      </td>
      <td style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem' }}>
        {wow ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
            <div>GP%: <Delta value={wow.grossProfitPct} format="pp" /></div>
            <div>Cost: <Delta value={wow.projectedCost} positiveIsGood={false} /></div>
            <div>Backlog: <Delta value={wow.backlog} /></div>
          </div>
        ) : <span style={{ color: '#cbd5e1' }}>—</span>}
      </td>
    </tr>
  );
};

const PMCard: React.FC<{ pm: PMReportRow }> = ({ pm }) => {
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const summaryMutation = useMutation({
    mutationFn: () => pmReportApi.generateSummary(pm).then(res => res.data),
    onSuccess: (data) => {
      setSummary(data.summary);
      setSummaryError(null);
    },
    onError: (err: any) => {
      setSummaryError(err?.response?.data?.error || 'Failed to generate summary');
    },
  });

  const meta = HEALTH_META[pm.overallHealth];

  return (
    <div
      className="card"
      style={{
        marginBottom: '1rem',
        padding: 0,
        borderLeft: `4px solid ${meta.border}`,
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '0.85rem 1rem',
          cursor: 'pointer',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          gap: '1rem',
          background: expanded ? '#f8fafc' : '#fff',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>{pm.pmName}</h3>
            <HealthPill level={pm.overallHealth} />
            {pm.departmentName && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{pm.departmentName}</span>}
            {!pm.linked && (
              <span style={{ fontSize: '0.65rem', color: '#b45309', background: '#fef3c7', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                unlinked
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: '#475569', flexWrap: 'wrap' }}>
            <span><strong>{pm.totals.activeJobs}</strong> open jobs</span>
            <span style={{ color: '#15803d' }}>{pm.healthCounts.green} healthy</span>
            <span style={{ color: '#b45309' }}>{pm.healthCounts.yellow} watch</span>
            <span style={{ color: '#b91c1c' }}>{pm.healthCounts.red} at risk</span>
            <span>Contract: <strong>{fmt$(pm.totals.contractAmount)}</strong></span>
            <span>GP%: <strong>{fmtPct(pm.totals.aggregateGrossProfitPct)}</strong></span>
            <span>Backlog: <strong>{fmt$(pm.totals.backlog)}</strong></span>
            <span>Cash Flow: <strong style={{ color: pm.totals.cashFlow < 0 ? '#b91c1c' : '#15803d' }}>{fmt$(pm.totals.cashFlow)}</strong></span>
          </div>
        </div>
        <div>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid #e2e8f0' }}>
          {/* AI Summary Panel */}
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 0.9rem',
              background: 'linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%)',
              border: '1px solid #c7d2fe',
              borderRadius: '6px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: summary || summaryError ? '0.6rem' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#4338ca', fontSize: '0.85rem' }}>
                <AutoAwesomeIcon style={{ fontSize: '1rem' }} />
                Titan's Assessment
              </div>
              <button
                onClick={() => summaryMutation.mutate()}
                disabled={summaryMutation.isPending}
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
              >
                {summaryMutation.isPending ? 'Analyzing…' : (summary ? 'Regenerate' : 'Generate Summary')}
              </button>
            </div>
            {summaryError && (
              <div style={{ color: '#b91c1c', fontSize: '0.8rem' }}>{summaryError}</div>
            )}
            {summary && (
              <div style={{ fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {summary}
              </div>
            )}
            {!summary && !summaryError && !summaryMutation.isPending && (
              <div style={{ fontSize: '0.75rem', color: '#6366f1' }}>
                Click "Generate Summary" to have Titan analyze this PM's portfolio health and performance trends.
              </div>
            )}
          </div>

          {/* Portfolio Totals Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <Stat label="Projected Revenue" value={fmt$(pm.totals.projectedRevenue)} />
            <Stat label="Earned Revenue" value={fmt$(pm.totals.earnedRevenue)} />
            <Stat label="Projected Cost" value={fmt$(pm.totals.projectedCost)} sub={`vs est ${fmt$(pm.totals.estimatedCost)}`} />
            <Stat label="Cost Variance" value={fmtPct(pm.totals.aggregateCostVariance * 100)} color={pm.totals.aggregateCostVariance > 0.05 ? '#b91c1c' : pm.totals.aggregateCostVariance > 0 ? '#b45309' : '#15803d'} />
            <Stat label="Aggregate GP%" value={fmtPct(pm.totals.aggregateGrossProfitPct)} />
            <Stat label="Billed To Date" value={fmt$(pm.totals.billed)} />
            <Stat label="Open Receivables" value={fmt$(pm.totals.openReceivables)} />
            <Stat label="Backlog" value={fmt$(pm.totals.backlog)} />
          </div>

          {/* Jobs Table */}
          <div style={{ overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={th}>Health</th>
                  <th style={th}>Contract / Description</th>
                  <th style={{ ...th, textAlign: 'right' }}>Contract $</th>
                  <th style={{ ...th, textAlign: 'right' }}>% Complete</th>
                  <th style={{ ...th, textAlign: 'right' }}>GP %</th>
                  <th style={{ ...th, textAlign: 'right' }}>Cost Var</th>
                  <th style={{ ...th, textAlign: 'right' }}>Over/(Under) Billed</th>
                  <th style={{ ...th, textAlign: 'right' }}>Backlog</th>
                  <th style={{ ...th, textAlign: 'right' }}>Cash Flow</th>
                  <th style={th}>GP% Trend</th>
                  <th style={th}>Week-over-Week</th>
                </tr>
              </thead>
              <tbody>
                {pm.jobs.map(j => <JobRow key={j.contractNumber} job={j} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const th: React.CSSProperties = {
  padding: '0.5rem 0.6rem',
  fontSize: '0.7rem',
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const Stat: React.FC<{ label: string; value: string; sub?: string; color?: string }> = ({ label, value, sub, color }) => (
  <div style={{ background: '#f8fafc', padding: '0.5rem 0.65rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
    <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.02em' }}>{label}</div>
    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: color || '#0f172a', marginTop: '0.1rem' }}>{value}</div>
    {sub && <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.1rem' }}>{sub}</div>}
  </div>
);

const PMReport: React.FC = () => {
  const [healthFilter, setHealthFilter] = useState<'all' | HealthLevel>('all');
  const [selectedPMs, setSelectedPMs] = useState<string[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['pm-report'],
    queryFn: () => pmReportApi.getReport().then(res => res.data),
  });

  const handleExportPdf = async () => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      await pmReportApi.downloadPdf({
        pm_keys: selectedPMs.length ? selectedPMs : undefined,
        departments: selectedDepts.length ? selectedDepts : undefined,
        health: healthFilter !== 'all' ? healthFilter : undefined,
      });
    } catch (err: any) {
      setPdfError(err?.message || 'PDF export failed');
    } finally {
      setPdfLoading(false);
    }
  };

  const deptOptions = useMemo(() => {
    if (!report) return [];
    const counts = new Map<string, number>();
    for (const p of report.pms) {
      const key = p.departmentName || '(Unassigned)';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, n]) => ({
        value: name,
        label: name,
        subtitle: `${n} PM${n === 1 ? '' : 's'}`,
      }));
  }, [report]);

  const pmOptions = useMemo(() => {
    if (!report) return [];
    const deptSet = selectedDepts.length > 0 ? new Set(selectedDepts) : null;
    return report.pms
      .filter(p => !deptSet || deptSet.has(p.departmentName || '(Unassigned)'))
      .map(p => ({
        value: p.key,
        label: p.pmName,
        subtitle: p.departmentName
          ? `${p.departmentName} · ${p.totals.activeJobs} open job${p.totals.activeJobs === 1 ? '' : 's'}`
          : `${p.totals.activeJobs} open job${p.totals.activeJobs === 1 ? '' : 's'}`,
      }));
  }, [report, selectedDepts]);

  const filteredPMs = useMemo(() => {
    if (!report) return [];
    let list = report.pms;
    if (selectedDepts.length > 0) {
      const set = new Set(selectedDepts);
      list = list.filter(p => set.has(p.departmentName || '(Unassigned)'));
    }
    if (selectedPMs.length > 0) {
      const set = new Set(selectedPMs);
      list = list.filter(p => set.has(p.key));
    }
    if (healthFilter !== 'all') {
      list = list.filter(p => p.overallHealth === healthFilter);
    }
    return list;
  }, [report, healthFilter, selectedPMs, selectedDepts]);

  if (isLoading) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <div style={{ color: '#64748b' }}>Loading Project Manager Report…</div>
      </div>
    );
  }

  if (isError || !report) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <Link to="/reports" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>&larr; Back to Reports</Link>
        <h1 style={{ marginTop: '0.5rem' }}>Project Manager Report</h1>
        <div style={{ marginTop: '1rem', padding: '2rem', textAlign: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c' }}>
          <EngineeringIcon style={{ fontSize: '2rem' }} />
          <div style={{ marginTop: '0.5rem' }}>Unable to load report. Try again or check Vista contract data.</div>
        </div>
      </div>
    );
  }

  const counts = report.pms.reduce(
    (acc, p) => {
      acc[p.overallHealth] += 1;
      return acc;
    },
    { green: 0, yellow: 0, red: 0 } as Record<HealthLevel, number>
  );

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <Link to="/reports" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>&larr; Back to Reports</Link>
          <h1 style={{ margin: '0.4rem 0 0.25rem 0', fontSize: '1.6rem', color: '#0f172a' }}>Project Manager Report</h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
            Health and performance of every open job, grouped by PM. Trends and deltas come from weekly Vista snapshots; click any PM to drill in and let Titan summarize their book.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExportPdf}
            disabled={pdfLoading}
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', whiteSpace: 'nowrap' }}
          >
            {pdfLoading ? 'Generating PDF…' : 'Export PDF'}
          </button>
          <Link
            to="/reports/scheduled"
            style={{ fontSize: '0.7rem', color: '#3b82f6', textDecoration: 'none' }}
          >
            Schedule this report →
          </Link>
          {pdfError && <div style={{ fontSize: '0.7rem', color: '#b91c1c' }}>{pdfError}</div>}
        </div>
      </div>

      {/* KPI / Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <KPI label="PMs" value={String(report.meta.pmCount)} />
          <KPI label="Open Jobs" value={String(report.meta.activeJobsCounted)} />
          <KPI label="With Trend Data" value={`${report.meta.projectsWithSnapshots} / ${report.meta.activeJobsCounted}`} />
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Health:</span>
          <FilterBtn active={healthFilter === 'all'} onClick={() => setHealthFilter('all')} label={`All (${report.pms.length})`} />
          <FilterBtn active={healthFilter === 'red'} onClick={() => setHealthFilter('red')} label={`At Risk (${counts.red})`} color="#b91c1c" />
          <FilterBtn active={healthFilter === 'yellow'} onClick={() => setHealthFilter('yellow')} label={`Watch (${counts.yellow})`} color="#b45309" />
          <FilterBtn active={healthFilter === 'green'} onClick={() => setHealthFilter('green')} label={`Healthy (${counts.green})`} color="#15803d" />
        </div>
      </div>

      {/* Department + PM Multi-Selects */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Department</div>
          <SearchableMultiSelect
            options={deptOptions}
            values={selectedDepts}
            onChange={(vals) => {
              setSelectedDepts(vals);
              // When narrowing departments, drop any selected PMs that no longer fit.
              if (vals.length > 0 && selectedPMs.length > 0 && report) {
                const allowed = new Set(vals);
                const pmKeysInDept = new Set(
                  report.pms.filter(p => allowed.has(p.departmentName || '(Unassigned)')).map(p => p.key)
                );
                setSelectedPMs(prev => prev.filter(k => pmKeysInDept.has(k)));
              }
            }}
            placeholder="All departments — type to filter..."
          />
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Project Manager</div>
          <SearchableMultiSelect
            options={pmOptions}
            values={selectedPMs}
            onChange={setSelectedPMs}
            placeholder="All PMs — type to filter..."
          />
        </div>
        {(selectedPMs.length > 0 || selectedDepts.length > 0) && (
          <button
            type="button"
            onClick={() => { setSelectedPMs([]); setSelectedDepts([]); }}
            style={{
              fontSize: '0.75rem',
              padding: '0.45rem 0.8rem',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#475569',
              cursor: 'pointer',
              alignSelf: 'end',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* PM Cards */}
      {filteredPMs.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '6px' }}>
          No PMs match the current filters.
        </div>
      ) : (
        <>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
            Showing {filteredPMs.length} of {report.pms.length} PMs
          </div>
          {filteredPMs.map(pm => <PMCard key={pm.key} pm={pm} />)}
        </>
      )}
    </div>
  );
};

const KPI: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem 0.85rem' }}>
    <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{value}</div>
  </div>
);

const FilterBtn: React.FC<{ active: boolean; onClick: () => void; label: string; color?: string }> = ({ active, onClick, label, color }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      fontSize: '0.75rem',
      padding: '0.35rem 0.7rem',
      borderRadius: '4px',
      border: active ? `2px solid ${color || '#3b82f6'}` : '1px solid #cbd5e1',
      background: active ? (color ? `${color}15` : '#eff6ff') : '#fff',
      color: active ? (color || '#1e40af') : '#475569',
      cursor: 'pointer',
      fontWeight: active ? 600 : 400,
    }}
  >
    {label}
  </button>
);

export default PMReport;
