import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { teamsApi, TeamFinancials, TeamProject, TeamAnnualGoal, TeamRevenuePipeline } from '../../services/teams';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

type Dimension = 'market' | 'manager' | 'customer' | 'year';

type FilterSelection = {
  label: string;
  dimension: Dimension;
  value: string;
  year?: number;
} | null;

function fmtM(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function projectYear(p: TeamProject): number {
  return new Date(p.start_date || p.created_at).getFullYear();
}

function statusColor(status: string): string {
  const m: Record<string, string> = { 'Open': '#10b981', 'Soft-Closed': '#f59e0b', 'Hard-Closed': '#6b7280' };
  return m[status] || '#6b7280';
}

interface BarTableRow {
  label: string;
  contract_value: number;
  backlog?: number;
  gm_pct?: number | null;
  project_count: number;
}

const BarTable: React.FC<{
  rows: BarTableRow[];
  color: string;
  showGm?: boolean;
  onRowClick?: (label: string) => void;
}> = ({ rows, color, showGm = true, onRowClick }) => {
  const maxVal = Math.max(...rows.map(r => r.contract_value), 1);
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
          <th style={{ textAlign: 'left', padding: '5px 8px', color: '#64748b', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Name</th>
          <th style={{ textAlign: 'left', padding: '5px 8px', color: '#64748b', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.4px', width: '40%' }}>Revenue</th>
          {showGm && <th style={{ textAlign: 'right', padding: '5px 8px', color: '#64748b', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>GM%</th>}
          <th style={{ textAlign: 'right', padding: '5px 8px', color: '#64748b', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Backlog</th>
          <th style={{ textAlign: 'right', padding: '5px 8px', color: '#64748b', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Jobs</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            style={{ borderBottom: '1px solid #f1f5f9', cursor: onRowClick ? 'pointer' : undefined, transition: 'background 0.1s' }}
            onClick={() => onRowClick?.(row.label)}
            onMouseEnter={e => { if (onRowClick) e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; }}
          >
            <td style={{ padding: '6px 8px', fontWeight: 500, color: '#1e293b', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</td>
            <td style={{ padding: '6px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: `${(row.contract_value / maxVal) * 100}%`, height: '100%', background: color, borderRadius: '5px' }} />
                </div>
                <span style={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#1e293b', minWidth: '52px', textAlign: 'right' }}>{fmtM(row.contract_value)}</span>
              </div>
            </td>
            {showGm && (
              <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700,
                color: row.gm_pct == null ? '#94a3b8' : row.gm_pct >= 15 ? '#059669' : '#f59e0b' }}>
                {row.gm_pct != null ? `${row.gm_pct.toFixed(1)}%` : '—'}
              </td>
            )}
            <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>{row.backlog != null ? fmtM(row.backlog) : '—'}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>{row.project_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>{title}</span>
    </div>
    <div style={{ padding: '1rem' }}>{children}</div>
  </div>
);

const LINE_COLORS = [
  '#002356', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1',
  '#14b8a6', '#84cc16',
];

function pivotToLineChart(
  rows: Array<{ year: number; contract_value: number; [key: string]: any }>,
  dimensionKey: string,
) {
  const years = [...new Set(rows.map(r => r.year))].sort((a, b) => a - b);
  const dimensions = [...new Set(rows.map(r => r[dimensionKey]))];
  const lookup = new Map<string, Map<number, number>>();
  for (const row of rows) {
    const dim = String(row[dimensionKey]);
    if (!lookup.has(dim)) lookup.set(dim, new Map());
    lookup.get(dim)!.set(row.year, row.contract_value);
  }
  return {
    labels: years.map(String),
    datasets: dimensions.map((dim, i) => ({
      label: String(dim),
      data: years.map(y => lookup.get(String(dim))?.get(y) ?? null),
      borderColor: LINE_COLORS[i % LINE_COLORS.length],
      backgroundColor: LINE_COLORS[i % LINE_COLORS.length] + '18',
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.3,
      spanGaps: true,
    })),
  };
}

// ── Revenue Pipeline Card ─────────────────────────────────────────────────────

const RevenuePipelineCard: React.FC<{ teamId: number }> = ({ teamId }) => {
  const { data: res, isLoading } = useQuery({
    queryKey: ['team-revenue-pipeline', teamId],
    queryFn: () => teamsApi.getRevenuePipeline(teamId),
  });
  const pipeline: TeamRevenuePipeline | undefined = res?.data.data;

  const currentYear = new Date().getFullYear();

  const rows: Array<{ label: string; isRolling12?: boolean } & (TeamRevenuePipeline['rolling12'] | (TeamRevenuePipeline['by_year'][number]))> = pipeline
    ? [
        { label: 'Rolling 12', isRolling12: true, ...pipeline.rolling12 },
        ...pipeline.by_year.map(r => ({ label: String(r.year), isRolling12: false, ...r })),
      ]
    : [];

  const maxBar = Math.max(
    ...rows.map(r => Math.max(r.goal ?? 0, r.secured + r.awarded_not_in_vista)),
    1,
  );

  const cellSt: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '0.8125rem', verticalAlign: 'middle' };

  if (isLoading) {
    return <Card title="Revenue Pipeline"><div style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>Loading…</div></Card>;
  }

  return (
    <Card title="Revenue Pipeline">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ ...cellSt, textAlign: 'left', fontWeight: 700, color: '#374151', width: 90 }}>Period</th>
            <th style={{ ...cellSt, textAlign: 'right', fontWeight: 600, color: '#64748b', width: 110 }}>Goal</th>
            <th style={{ ...cellSt, fontWeight: 600, color: '#64748b' }}>Progress</th>
            <th style={{ ...cellSt, textAlign: 'right', fontWeight: 600, color: '#166534', width: 110 }}>Secured</th>
            <th style={{ ...cellSt, textAlign: 'right', fontWeight: 600, color: '#1d4ed8', width: 130 }}>Awarded (not Vista)</th>
            <th style={{ ...cellSt, textAlign: 'right', fontWeight: 600, color: '#64748b', width: 110 }}>Needed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const total = row.secured + row.awarded_not_in_vista;
            const goal = row.goal;
            const needed = row.needed;
            const pctSecured  = goal ? Math.min((row.secured / goal) * 100, 100) : 0;
            const pctAwarded  = goal ? Math.min((row.awarded_not_in_vista / goal) * 100, 100 - pctSecured) : 0;
            const pctTotal    = pctSecured + pctAwarded;
            const isMet       = goal !== null && total >= goal;
            const isCurrentYear = !row.isRolling12 && (row as any).year === currentYear;

            return (
              <tr key={row.label} style={{ background: row.isRolling12 ? '#f0fdf4' : isCurrentYear ? '#fffbeb' : 'white' }}>
                <td style={{ ...cellSt, fontWeight: 700, color: '#0f172a' }}>
                  {row.label}
                  {row.isRolling12 && <span style={{ marginLeft: 6, fontSize: '0.65rem', background: '#dcfce7', color: '#166534', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>R12</span>}
                  {isCurrentYear && <span style={{ marginLeft: 6, fontSize: '0.65rem', background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>YTD</span>}
                </td>

                <td style={{ ...cellSt, textAlign: 'right', color: '#374151', fontWeight: 600 }}>
                  {goal !== null ? fmtM(goal) : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>

                {/* Stacked progress bar */}
                <td style={{ ...cellSt, minWidth: 140 }}>
                  {goal !== null ? (
                    <div style={{ position: 'relative' }}>
                      <div style={{ height: 10, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${pctSecured}%`, background: '#10b981', transition: 'width 0.3s' }} />
                        <div style={{ width: `${pctAwarded}%`, background: '#3b82f6', transition: 'width 0.3s' }} />
                      </div>
                      {isMet && (
                        <span style={{ position: 'absolute', right: 0, top: -1, fontSize: '0.65rem', color: '#166534', fontWeight: 700 }}>✓</span>
                      )}
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>
                        {pctTotal.toFixed(0)}% covered
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: '#d1d5db', fontSize: '0.75rem' }}>Set a goal to track</span>
                  )}
                </td>

                <td style={{ ...cellSt, textAlign: 'right', fontWeight: 600, color: '#166534' }}>
                  {fmtM(row.secured)}
                </td>

                <td style={{ ...cellSt, textAlign: 'right', fontWeight: 600, color: '#1d4ed8' }}>
                  {row.awarded_not_in_vista > 0 ? fmtM(row.awarded_not_in_vista) : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>

                <td style={{ ...cellSt, textAlign: 'right', fontWeight: 700 }}>
                  {needed === null
                    ? <span style={{ color: '#d1d5db' }}>—</span>
                    : needed <= 0
                      ? <span style={{ color: '#166534' }}>On track</span>
                      : <span style={{ color: '#dc2626' }}>{fmtM(needed)}</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 16, padding: '8px 12px 4px', fontSize: '0.7rem', color: '#94a3b8' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#10b981', borderRadius: 2, marginRight: 4 }} />Secured (Vista backlog)</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#3b82f6', borderRadius: 2, marginRight: 4 }} />Awarded not in Vista</span>
        <span>Goals set in Annual Goals section below.</span>
      </div>
    </Card>
  );
};

// ── Annual Goals Card ─────────────────────────────────────────────────────────

interface AnnualGoalsCardProps {
  teamId: number;
  byYear: Array<{ year: number; contract_value: number; gm_pct: number | null }>;
}

const AnnualGoalsCard: React.FC<AnnualGoalsCardProps> = ({ teamId, byYear }) => {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3];

  const { data: goalsRes } = useQuery({
    queryKey: ['team-annual-goals', teamId],
    queryFn: () => teamsApi.getAnnualGoals(teamId),
  });
  const goals: TeamAnnualGoal[] = goalsRes?.data.data ?? [];

  // editing state: `${year}_revenue` | `${year}_margin` → raw string
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);

  const saveMutation = useMutation({
    mutationFn: ({ year, data }: { year: number; data: { revenue_goal?: number | null; margin_goal?: number | null } }) =>
      teamsApi.updateAnnualGoal(teamId, year, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-annual-goals', teamId] }),
  });

  const getGoal = (year: number): TeamAnnualGoal =>
    goals.find(g => g.year === year) ?? { year, revenue_goal: null, margin_goal: null };

  const getActual = (year: number) => byYear.find(r => r.year === year);

  const commitEdit = (year: number, field: 'revenue' | 'margin') => {
    if (!editing) return;
    const raw = editing.value.trim().replace(/[$,%]/g, '');
    const parsed = raw === '' ? null : parseFloat(raw);
    if (parsed !== null && isNaN(parsed)) { setEditing(null); return; }
    setEditing(null);
    saveMutation.mutate({
      year,
      data: field === 'revenue'
        ? { revenue_goal: parsed, margin_goal: getGoal(year).margin_goal }
        : { revenue_goal: getGoal(year).revenue_goal, margin_goal: parsed },
    });
  };

  const fmtDelta = (actual: number, goal: number, isPercent: boolean) => {
    const diff = actual - goal;
    const pct = goal !== 0 ? (diff / Math.abs(goal)) * 100 : 0;
    const sign = diff >= 0 ? '+' : '';
    const color = diff >= 0 ? '#166534' : '#dc2626';
    const label = isPercent
      ? `${sign}${diff.toFixed(1)}pp`
      : `${sign}${pct.toFixed(0)}%`;
    return <span style={{ color, fontWeight: 700, fontSize: '0.75rem' }}>{label}</span>;
  };

  const cellStyle: React.CSSProperties = {
    padding: '9px 12px', borderBottom: '1px solid #f1f5f9',
    fontSize: '0.8125rem', verticalAlign: 'middle',
  };
  const editableCell = (
    year: number, field: 'revenue' | 'margin',
    displayVal: string, placeholder: string,
  ) => {
    const key = `${year}_${field}`;
    const isEditing = editing?.key === key;
    return (
      <td style={{ ...cellStyle, textAlign: 'right', minWidth: 110 }}>
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={editing.value}
            onChange={e => setEditing({ key, value: e.target.value })}
            onBlur={() => commitEdit(year, field)}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditing(null);
            }}
            style={{
              width: 90, padding: '3px 7px', borderRadius: 5,
              border: '1px solid #d97706', fontSize: '0.8rem',
              textAlign: 'right', background: 'white', outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={() => setEditing({ key, value: displayVal !== '—' ? displayVal.replace(/[$M%]/g, '') : '' })}
            title="Click to edit"
            style={{
              cursor: 'text', borderBottom: '1px dashed #d97706',
              paddingBottom: 1, color: displayVal === '—' ? '#d1d5db' : '#92400e',
              fontWeight: displayVal === '—' ? 400 : 600,
            }}
          >
            {displayVal}
          </span>
        )}
      </td>
    );
  };

  return (
    <Card title="Annual Revenue & Margin Goals">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ ...cellStyle, textAlign: 'left', fontWeight: 700, color: '#374151', width: 60 }}>Year</th>
            <th style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Revenue Goal</th>
            <th style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Actual</th>
            <th style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: '#64748b' }}>vs Goal</th>
            <th style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Margin Goal</th>
            <th style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: '#64748b' }}>Actual GM%</th>
            <th style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: '#64748b' }}>vs Goal</th>
          </tr>
        </thead>
        <tbody>
          {years.map(year => {
            const goal = getGoal(year);
            const actual = getActual(year);
            const isFuture = year > currentYear;

            const revGoalDisplay = goal.revenue_goal !== null ? fmtM(Number(goal.revenue_goal)) : '—';
            const revActual = actual ? fmtM(actual.contract_value) : '—';
            const gmGoalDisplay = goal.margin_goal !== null ? `${Number(goal.margin_goal).toFixed(1)}%` : '—';
            const gmActual = actual?.gm_pct != null ? `${Number(actual.gm_pct).toFixed(1)}%` : '—';

            return (
              <tr key={year} style={{ background: year === currentYear ? '#fffbeb' : 'white' }}>
                <td style={{ ...cellStyle, fontWeight: 700, color: year === currentYear ? '#92400e' : '#0f172a' }}>
                  {year}
                  {year === currentYear && (
                    <span style={{ marginLeft: 6, fontSize: '0.65rem', background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>YTD</span>
                  )}
                </td>

                {editableCell(year, 'revenue', revGoalDisplay, 'e.g. 120M')}

                <td style={{ ...cellStyle, textAlign: 'right', color: '#0f172a', fontWeight: isFuture ? 400 : 600 }}>
                  {revActual}
                </td>

                <td style={{ ...cellStyle, textAlign: 'right' }}>
                  {!isFuture && actual && goal.revenue_goal !== null
                    ? fmtDelta(actual.contract_value, Number(goal.revenue_goal), false)
                    : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>

                {editableCell(year, 'margin', gmGoalDisplay, 'e.g. 15.5')}

                <td style={{ ...cellStyle, textAlign: 'right', color: '#0f172a', fontWeight: isFuture ? 400 : 600 }}>
                  {gmActual}
                </td>

                <td style={{ ...cellStyle, textAlign: 'right' }}>
                  {!isFuture && actual?.gm_pct != null && goal.margin_goal !== null
                    ? fmtDelta(Number(actual.gm_pct), Number(goal.margin_goal), true)
                    : <span style={{ color: '#d1d5db' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', padding: '8px 12px 4px' }}>
        Click any goal cell to edit. Revenue in millions (e.g. 120 = $120M). Margin as percent (e.g. 15.5 = 15.5%).
      </div>
    </Card>
  );
};

interface Props {
  teamId: number;
  teamColor: string;
  selectedStatuses: string[];
}

const TeamFinancialsTab: React.FC<Props> = ({ teamId, teamColor, selectedStatuses }) => {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<FilterSelection>(null);

  const { data: fin, isLoading } = useQuery<TeamFinancials>({
    queryKey: ['teams', teamId, 'financials', selectedStatuses],
    queryFn: () => teamsApi.getFinancials(teamId, selectedStatuses),
    enabled: !!teamId && selectedStatuses.length > 0,
  });

  const statusFilter = selectedStatuses.length === 1 && selectedStatuses[0] === 'Open' ? 'active' : 'all';
  const { data: allProjects = [] } = useQuery<TeamProject[]>({
    queryKey: ['teams', teamId, 'projects', statusFilter],
    queryFn: () => teamsApi.getProjects(teamId, statusFilter).then(r => r.data.data),
    enabled: !!teamId,
  });

  const filteredProjects = useMemo(() => {
    if (!selectedFilter) return allProjects;
    return allProjects.filter(p => {
      const yr = projectYear(p);
      const matchesDim = (() => {
        switch (selectedFilter.dimension) {
          case 'market':   return p.market === selectedFilter.value;
          case 'manager':  return p.manager_name === selectedFilter.value;
          case 'customer': return p.customer_name === selectedFilter.value;
          case 'year':     return yr === parseInt(selectedFilter.value);
        }
      })();
      if (!matchesDim) return false;
      if (selectedFilter.year != null) return yr === selectedFilter.year;
      return true;
    });
  }, [allProjects, selectedFilter]);

  const accentColor = teamColor || '#002356';

  const byYearManagerChart = pivotToLineChart(fin?.by_year_manager || [], 'manager_name');
  const byYearMarketChart  = pivotToLineChart(fin?.by_year_market  || [], 'market');
  const byYearCustomerRevenueChart = pivotToLineChart(fin?.by_year_customer || [], 'customer_name');

  const byYearCustomerGmChart = (() => {
    const rows = fin?.by_year_customer || [];
    const years = [...new Set(rows.map(r => r.year))].sort((a, b) => a - b);
    const customers = [...new Set(rows.map(r => r.customer_name))];
    const lookup = new Map<string, Map<number, number | null>>();
    for (const row of rows) {
      if (!lookup.has(row.customer_name)) lookup.set(row.customer_name, new Map());
      lookup.get(row.customer_name)!.set(row.year, row.gm_pct);
    }
    return {
      labels: years.map(String),
      datasets: customers.map((c, i) => ({
        label: c,
        data: years.map(y => lookup.get(c)?.get(y) ?? null),
        borderColor: LINE_COLORS[i % LINE_COLORS.length],
        backgroundColor: LINE_COLORS[i % LINE_COLORS.length] + '18',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.3,
        spanGaps: true,
      })),
    };
  })();

  const makeLineClick = (dimension: 'manager' | 'market' | 'customer') =>
    (_e: any, elements: any[], chart: any) => {
      if (!elements.length) return;
      const el = elements[0];
      const dimValue = chart.data.datasets[el.datasetIndex].label as string;
      const year = parseInt(chart.data.labels[el.index] as string);
      const dimLabel = dimension === 'manager' ? 'PM' : dimension === 'market' ? 'Market' : 'Customer';
      setSelectedFilter({ label: `${dimLabel}: ${dimValue} · ${year}`, dimension, value: dimValue, year });
    };

  const handleGmLineClick = (_e: any, elements: any[], chart: any) => {
    if (!elements.length) return;
    const el = elements[0];
    const customer = chart.data.datasets[el.datasetIndex].label as string;
    const year = parseInt(chart.data.labels[el.index] as string);
    setSelectedFilter({ label: `Customer: ${customer} · ${year}`, dimension: 'customer', value: customer, year });
  };

  const lineOpts = (yLabel: string, yFmt: (v: any) => string, onChartClick?: (e: any, els: any[], chart: any) => void) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest' as const, intersect: true },
    onClick: onChartClick,
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 10 }, boxWidth: 10, padding: 8 } },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.raw != null ? yFmt(ctx.raw) : '—'}` } },
    },
    scales: {
      x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
      y: { ticks: { callback: yFmt, font: { size: 10 } }, grid: { color: '#f1f5f9' }, title: { display: true, text: yLabel, font: { size: 10 }, color: '#94a3b8' } },
    },
  });

  const yearlyChartData = {
    labels: (fin?.by_year || []).map(r => String(r.year)),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Contract Value',
        data: (fin?.by_year || []).map(r => r.contract_value),
        backgroundColor: accentColor + 'cc',
        borderColor: accentColor,
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'y',
      },
      {
        type: 'line' as const,
        label: 'GM%',
        data: (fin?.by_year || []).map(r => r.gm_pct),
        borderColor: '#10b981',
        backgroundColor: '#10b98130',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#10b981',
        tension: 0.3,
        yAxisID: 'y2',
      },
    ],
  };

  const yearlyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest' as const, intersect: true },
    onClick: (_e: any, elements: any[], chart: any) => {
      if (!elements.length) return;
      const year = parseInt(chart.data.labels[elements[0].index] as string);
      setSelectedFilter({ label: `Year: ${year}`, dimension: 'year', value: String(year) });
    },
    plugins: {
      legend: { position: 'top' as const, labels: { font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            if (ctx.datasetIndex === 0) return `Revenue: ${fmtM(ctx.raw)}`;
            return `GM%: ${ctx.raw != null ? ctx.raw.toFixed(1) + '%' : '—'}`;
          },
        },
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        position: 'left' as const,
        ticks: { callback: (v: any) => fmtM(v), font: { size: 10 } },
        grid: { color: '#f1f5f9' },
      },
      y2: {
        type: 'linear' as const,
        position: 'right' as const,
        ticks: { callback: (v: any) => `${v}%`, font: { size: 10 } },
        grid: { drawOnChartArea: false },
      },
    },
  };

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading financials...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Revenue Pipeline */}
      <RevenuePipelineCard teamId={teamId} />

      {/* Annual Goals */}
      <AnnualGoalsCard teamId={teamId} byYear={fin?.by_year ?? []} />

      {/* Market + Manager */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <Card title="Revenue by Market">
          {(fin?.by_market || []).length > 0 ? (
            <BarTable
              rows={(fin?.by_market || []).map(r => ({ label: r.market, ...r }))}
              color={accentColor}
              onRowClick={label => setSelectedFilter({ label: `Market: ${label}`, dimension: 'market', value: label })}
            />
          ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
        </Card>

        <Card title="Revenue by Project Manager">
          {(fin?.by_manager || []).length > 0 ? (
            <BarTable
              rows={(fin?.by_manager || []).map(r => ({ label: r.manager_name, ...r }))}
              color={accentColor}
              onRowClick={label => setSelectedFilter({ label: `PM: ${label}`, dimension: 'manager', value: label })}
            />
          ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
        </Card>
      </div>

      {/* Top Customers */}
      <Card title="Top 10 Customers by Revenue">
        {(fin?.by_customer || []).length > 0 ? (
          <BarTable
            rows={(fin?.by_customer || []).map(r => ({ label: r.customer_name, ...r }))}
            color="#6366f1"
            showGm={false}
            onRowClick={label => setSelectedFilter({ label: `Customer: ${label}`, dimension: 'customer', value: label })}
          />
        ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
      </Card>

      {/* Yearly History */}
      <Card title="Revenue History by Year">
        {(fin?.by_year || []).length > 0 ? (
          <div style={{ position: 'relative', height: '280px' }}>
            <Chart type="bar" data={yearlyChartData} options={yearlyChartOptions} />
          </div>
        ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
      </Card>

      {/* Revenue by Year by PM + Market */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <Card title="Revenue by Year — Project Manager">
          {byYearManagerChart.datasets.length > 0 ? (
            <div style={{ position: 'relative', height: '300px' }}>
              <Chart type="line" data={byYearManagerChart} options={lineOpts('Revenue', fmtM, makeLineClick('manager'))} />
            </div>
          ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
        </Card>

        <Card title="Revenue by Year — Market">
          {byYearMarketChart.datasets.length > 0 ? (
            <div style={{ position: 'relative', height: '300px' }}>
              <Chart type="line" data={byYearMarketChart} options={lineOpts('Revenue', fmtM, makeLineClick('market'))} />
            </div>
          ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
        </Card>
      </div>

      {/* Top Customers — Revenue + GM% by Year */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <Card title="Top Customers — Revenue by Year">
          {byYearCustomerRevenueChart.datasets.length > 0 ? (
            <div style={{ position: 'relative', height: '300px' }}>
              <Chart type="line" data={byYearCustomerRevenueChart} options={lineOpts('Revenue', fmtM, makeLineClick('customer'))} />
            </div>
          ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
        </Card>

        <Card title="Top Customers — GM% by Year">
          {byYearCustomerGmChart.datasets.length > 0 ? (
            <div style={{ position: 'relative', height: '300px' }}>
              <Chart type="line" data={byYearCustomerGmChart} options={lineOpts('GM%', (v: any) => `${v}%`, handleGmLineClick)} />
            </div>
          ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
        </Card>
      </div>

      {/* Projects Table */}
      <Card title={selectedFilter ? `Projects — ${selectedFilter.label} (${filteredProjects.length})` : `All Projects (${allProjects.length})`}>
        {selectedFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Filtered: <strong>{selectedFilter.label}</strong>
            </span>
            <button
              onClick={() => setSelectedFilter(null)}
              style={{ padding: '2px 10px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontSize: '0.72rem', cursor: 'pointer' }}
            >
              Clear ×
            </button>
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                {['#', 'Project', 'Market', 'Manager', 'Customer', 'Contract Value', 'GM%', 'Backlog', 'Status'].map(h => (
                  <th key={h} style={{
                    textAlign: ['Contract Value', 'GM%', 'Backlog', '#'].includes(h) ? 'right' : 'left',
                    padding: '5px 8px', color: '#64748b', fontWeight: 600, fontSize: '0.68rem',
                    textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length > 0 ? filteredProjects.map(p => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                >
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#6366f1', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.project_number || '—'}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 500, color: '#1e293b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                  <td style={{ padding: '6px 8px', color: '#64748b' }}>{p.market || '—'}</td>
                  <td style={{ padding: '6px 8px', color: '#64748b', whiteSpace: 'nowrap' }}>{p.manager_name || '—'}</td>
                  <td style={{ padding: '6px 8px', color: '#64748b', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.customer_name || p.client || '—'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                    {p.contract_value ? fmtM(Number(p.contract_value)) : '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: p.gross_margin_percent != null ? (Number(p.gross_margin_percent) * 100 >= 15 ? '#059669' : '#f59e0b') : '#94a3b8' }}>
                    {p.gross_margin_percent != null ? `${(Number(p.gross_margin_percent) * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>
                    {p.backlog ? fmtM(Number(p.backlog)) : '—'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px', background: statusColor(p.status) + '20', color: statusColor(p.status), fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusColor(p.status), flexShrink: 0 }} />
                      {p.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                    {selectedFilter ? 'No projects match this filter.' : 'No projects found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
};

export default TeamFinancialsTab;
