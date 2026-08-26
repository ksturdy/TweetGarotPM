import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  laborApi,
  BoardFilters,
  LaborBoardRow,
  HeadcountChartRow,
  ASSIGNMENT_TRADES,
  ASSIGNMENT_ROLES,
  TIME_OFF_LABELS,
  TIME_OFF_COLORS,
  TimeOffType,
} from '../../services/labor';
import { employeesApi } from '../../services/employees';
import AssignDialog from '../../components/labor/AssignDialog';
import TimeOffDialog from '../../components/labor/TimeOffDialog';
import PillFilter from '../../components/labor/PillFilter';
import '../../styles/SalesPipeline.css';

const avatarColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
const colorFor = (id: number) => avatarColors[id % avatarColors.length];

type ColumnKey =
  | 'name' | 'title' | 'phone' | 'availability'
  | 'current_project' | 'next_project'
  | 'profile_type' | 'employee_group' | 'trade';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  width: number;
  sortable: boolean;
  editable?: 'select-title' | 'select-trade' | 'text-group' | 'text-phone' | 'select-profile';
}

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name', width: 220, sortable: true },
  { key: 'title', label: 'Title', width: 130, sortable: true, editable: 'select-title' },
  { key: 'phone', label: 'Phone', width: 140, sortable: true, editable: 'text-phone' },
  { key: 'availability', label: 'Availability', width: 180, sortable: true },
  { key: 'current_project', label: 'Current Project', width: 230, sortable: true },
  { key: 'next_project', label: 'Next Project', width: 230, sortable: true },
  { key: 'trade', label: 'Trade', width: 120, sortable: true, editable: 'select-trade' },
  { key: 'employee_group', label: 'Group', width: 100, sortable: true, editable: 'text-group' },
  { key: 'profile_type', label: 'Profile Type', width: 120, sortable: true, editable: 'select-profile' },
];

const COLUMN_PREFS_KEY = 'labor-board-columns-v1';
const SORT_PREFS_KEY = 'labor-board-sort-v1';

const PROFILE_TYPES = ['Hourly', 'Salary'] as const;

const loadColumnPrefs = (): ColumnDef[] => {
  try {
    const raw = localStorage.getItem(COLUMN_PREFS_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const saved = JSON.parse(raw) as { key: ColumnKey; width: number }[];
    return DEFAULT_COLUMNS.map((c) => {
      const found = saved.find((s) => s.key === c.key);
      return found ? { ...c, width: found.width } : c;
    });
  } catch {
    return DEFAULT_COLUMNS;
  }
};

// ── Trade colours (matching LaborForecast) ──────────────────────────────────
const CHART_TRADES = [
  { key: 'pf' as const, label: 'Pipefitter',   color: '#3b82f6' },
  { key: 'sm' as const, label: 'Sheet Metal',  color: '#10b981' },
  { key: 'pl' as const, label: 'Plumber',      color: '#f59e0b' },
  { key: 'other' as const, label: 'Other',     color: '#8b5cf6' },
];

const HORIZON_OPTIONS = [
  { label: '3mo',  value: 3  },
  { label: '6mo',  value: 6  },
  { label: '12mo', value: 12 },
  { label: '18mo', value: 18 },
] as const;

function fmtMonthLabel(ym: string) {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

interface HeadcountChartProps {
  data: HeadcountChartRow[];
  horizon: number;
  onHorizonChange: (h: number) => void;
}

const HeadcountChart: React.FC<HeadcountChartProps> = ({ data, horizon, onHorizonChange }) => {
  const chartH = 220;
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const yMax = Math.ceil(maxVal / 5) * 5 || 10;
  const barCount = data.length;
  const barWidth = 100 / barCount;

  // year boundaries for x-axis labels
  const yearBoundaries: { index: number; label: string }[] = [];
  let lastYear = '';
  data.forEach((d, i) => {
    const yr = d.month.slice(0, 4);
    if (yr !== lastYear) { yearBoundaries.push({ index: i, label: yr }); lastYear = yr; }
  });

  const labelEvery = barCount <= 12 ? 1 : barCount <= 18 ? 2 : 3;

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.625rem', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#002356' }}>Headcount by Trade</span>
          <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.5rem' }}>active + planned assignments</span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {HORIZON_OPTIONS.map(o => (
            <button key={o.value} onClick={() => onHorizonChange(o.value)} style={{
              padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #e5e7eb',
              borderRadius: '0.375rem', cursor: 'pointer', background: horizon === o.value ? '#002356' : '#f8fafc',
              color: horizon === o.value ? '#fff' : '#374151',
            }}>{o.label}</button>
          ))}
        </div>
      </div>

      <div style={{ height: chartH + 50, position: 'relative' }}>
        <svg width="100%" height={chartH + 50} style={{ overflow: 'visible' }}>
          {/* Y-axis labels + grid */}
          <text x="0" y="10"          fontSize="10" fill="#64748b">{yMax} ppl</text>
          <text x="0" y={chartH / 2} fontSize="10" fill="#64748b">{Math.round(yMax / 2)}</text>
          <text x="0" y={chartH}     fontSize="10" fill="#64748b">0</text>
          <line x1="40" y1="0"          x2="100%" y2="0"          stroke="#e2e8f0" strokeDasharray="2,2" />
          <line x1="40" y1={chartH / 2} x2="100%" y2={chartH / 2} stroke="#e2e8f0" strokeDasharray="2,2" />
          <line x1="40" y1={chartH}     x2="100%" y2={chartH}     stroke="#e2e8f0" />

          <g transform="translate(45, 0)">
            {/* Year boundary lines */}
            {yearBoundaries.map(b => (
              <line key={`yb-${b.index}`}
                x1={`${(b.index / barCount) * 95}%`} y1="0"
                x2={`${(b.index / barCount) * 95}%`} y2={chartH + 5}
                stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,2" />
            ))}

            {/* Bars */}
            {data.map((d, i) => {
              const xPct = (i / barCount) * 95;
              const showLabel = i % labelEvery === 0;
              let stackY = chartH;

              return (
                <g key={d.month}>
                  {CHART_TRADES.slice().reverse().map(t => {
                    const count = d[t.key];
                    const h = yMax > 0 ? (count / yMax) * chartH : 0;
                    if (h < 0.3) return null;
                    stackY -= h;
                    return (
                      <rect key={t.key}
                        x={`${xPct}%`} y={stackY}
                        width={`${barWidth * 0.82}%`} height={h}
                        fill={t.color} rx="1">
                        <title>{d.month}: {t.label} {count}</title>
                      </rect>
                    );
                  })}
                  {showLabel && (
                    <text x={`${xPct + barWidth * 0.41}%`} y={chartH + 14}
                      fontSize="9" fill="#64748b" textAnchor="middle">
                      {fmtMonthLabel(d.month)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Year labels */}
            {yearBoundaries.map((b, idx) => {
              const xStart = (b.index / barCount) * 95;
              const nextB  = yearBoundaries[idx + 1];
              const xEnd   = nextB ? (nextB.index / barCount) * 95 : 95;
              return (
                <text key={`yl-${b.index}`}
                  x={`${(xStart + xEnd) / 2}%`} y={chartH + 30}
                  fontSize="11" fontWeight="600" fill="#1e293b" textAnchor="middle">
                  {b.label}
                </text>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
        {CHART_TRADES.filter(t => data.some(d => d[t.key] > 0)).map(t => (
          <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#374151' }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: t.color, display: 'inline-block' }} />
            {t.label}
          </div>
        ))}
      </div>
    </div>
  );
};

const LaborBoard: React.FC = () => {
  const [filters, setFilters] = useState<BoardFilters>({});
  const [search, setSearch] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [timeOffTarget, setTimeOffTarget] = useState<{ id: number; name: string } | null>(null);
  const [columns, setColumns] = useState<ColumnDef[]>(loadColumnPrefs);
  const [chartHorizon, setChartHorizon] = useState(12);
  const [sort, setSort] = useState<{ key: ColumnKey; dir: 'asc' | 'desc' } | null>(() => {
    try {
      const raw = localStorage.getItem(SORT_PREFS_KEY);
      return raw ? JSON.parse(raw) : { key: 'name', dir: 'asc' };
    } catch { return { key: 'name', dir: 'asc' }; }
  });

  const qc = useQueryClient();

  const { data: rows, isLoading, isFetching } = useQuery({
    queryKey: ['labor-board', filters, search],
    queryFn: () => laborApi.getBoard({ ...filters, search: search || undefined }),
    placeholderData: keepPreviousData,
  });

  const { data: allRows } = useQuery({
    queryKey: ['labor-board', {}, ''],
    queryFn: () => laborApi.getBoard(),
    staleTime: 5 * 60_000,
  });

  const { data: chartData = [] } = useQuery({
    queryKey: ['labor-headcount-chart', chartHorizon],
    queryFn: () => laborApi.getHeadcountChart(chartHorizon),
    staleTime: 5 * 60_000,
  });

  const { titles, trades, groups, profiles } = useMemo(() => {
    const t = new Set<string>(); const tr = new Set<string>(ASSIGNMENT_TRADES); const g = new Set<string>(); const p = new Set<string>(PROFILE_TYPES);
    (allRows || rows || []).forEach((r) => {
      if (r.title) t.add(r.title);
      if (r.trade) tr.add(r.trade);
      if (r.employee_group) g.add(r.employee_group);
      if (r.profile_type) p.add(r.profile_type);
    });
    // Pre-seed titles with canonical assignment roles so the inline picker is useful before Vista data lands.
    ASSIGNMENT_ROLES.forEach((r) => t.add(r));
    return {
      titles: [...t].sort(),
      trades: [...tr].sort(),
      groups: [...g].sort(),
      profiles: [...p].sort(),
    };
  }, [allRows, rows]);

  // Persist column widths + sort state to localStorage on change.
  useEffect(() => {
    try {
      localStorage.setItem(
        COLUMN_PREFS_KEY,
        JSON.stringify(columns.map((c) => ({ key: c.key, width: c.width })))
      );
    } catch { /* quota exceeded — ignore */ }
  }, [columns]);

  useEffect(() => {
    try { localStorage.setItem(SORT_PREFS_KEY, JSON.stringify(sort)); } catch { /* ignore */ }
  }, [sort]);

  const setF = (k: keyof BoardFilters, v: string | undefined) =>
    setFilters((prev) => ({ ...prev, [k]: v || undefined }));

  const clearFilters = () => { setFilters({}); setSearch(''); };

  const handleSort = (key: ColumnKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  };

  const handleResize = (key: ColumnKey, newWidth: number) => {
    setColumns((prev) => prev.map((c) => (c.key === key ? { ...c, width: Math.max(60, newWidth) } : c)));
  };

  const patchEmployee = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: any }) =>
      employeesApi.patchLaborFields(id, patch).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labor-board'] });
    },
  });

  const sortedRows = useMemo(() => {
    if (!rows) return [] as LaborBoardRow[];
    if (!sort) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const key = sort.key;
    const getVal = (r: LaborBoardRow): string | number => {
      switch (key) {
        case 'name': return `${r.last_name || ''} ${r.first_name || ''}`.toLowerCase();
        case 'title': return (r.title || r.job_title || '').toLowerCase();
        case 'phone': return (r.mobile_phone || r.phone || '').toLowerCase();
        case 'availability': return r.availability;
        case 'current_project': return (r.current_project_name || '').toLowerCase();
        case 'next_project': return (r.next_project_name || '').toLowerCase();
        case 'trade': return (r.trade || '').toLowerCase();
        case 'employee_group': return (r.employee_group || '').toLowerCase();
        case 'profile_type': return (r.profile_type || '').toLowerCase();
      }
    };
    return [...rows].sort((a, b) => {
      const av = getVal(a); const bv = getVal(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, sort]);

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <h1>👷 Labor Board</h1>
            <div className="sales-subtitle">
              Where every craft employee is assigned today, next, and beyond
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            onClick={() => setAssignOpen(true)}
            style={{ background: '#002356', color: 'white', border: 'none', padding: '0.6rem 1.1rem', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            + Assign Crew
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="sales-kpi-grid">
        <Kpi tone="blue" label="Total Active Employees" loader={() => laborApi.getSummary().then(s => s.total_employees)} />
        <Kpi tone="green" label="Currently Assigned" loader={() => laborApi.getSummary().then(s => s.currently_assigned)} />
        <Kpi tone="amber" label="Upcoming Assignments" loader={() => laborApi.getSummary().then(s => s.upcoming_assignments)} />
        <Kpi tone="purple" label="Ending in 2 Weeks" loader={() => laborApi.getSummary().then(s => s.ending_within_two_weeks)} />
        <KpiLink tone="amber" label="Unfilled Roles" to="/labor/unfilled-roles" loader={() => laborApi.getSummary().then(s => s.unfilled_roles)} />
      </div>

      {/* Headcount chart */}
      <HeadcountChart data={chartData} horizon={chartHorizon} onHorizonChange={setChartHorizon} />

      {/* Quick navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', padding: '0 0 0 0' }}>
        <Link to="/labor/accounts" style={{ fontSize: '0.8rem', color: '#002356', textDecoration: 'none', padding: '0.3rem 0.75rem', background: '#ede9fe', borderRadius: 6, fontWeight: 600 }}>
          🏭 Labor Accounts
        </Link>
        <Link to="/labor/unfilled-roles" style={{ fontSize: '0.8rem', color: '#92400e', textDecoration: 'none', padding: '0.3rem 0.75rem', background: '#fef3c7', borderRadius: 6, fontWeight: 600 }}>
          🔓 Unfilled Roles
        </Link>
      </div>

      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">
            All Employees ({sortedRows.length})
            {isFetching && !isLoading ? (
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 8 }}>updating...</span>
            ) : null}
          </div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {(filters.title || filters.trade || filters.group || filters.profile_type || search) && (
              <button onClick={clearFilters} className="sales-filter-btn" style={{ color: '#dc2626' }}>
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0.5rem 1rem 0.75rem' }}>
          <PillFilter label="Title" value={filters.title} options={titles} onChange={(v) => setF('title', v)} />
          <PillFilter label="Group" value={filters.group} options={groups} onChange={(v) => setF('group', v)} />
          <PillFilter label="Trade" value={filters.trade} options={trades} onChange={(v) => setF('trade', v)} />
          <PillFilter label="Profile" value={filters.profile_type} options={profiles} onChange={(v) => setF('profile_type', v)} />
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : sortedRows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No employees match these filters.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem', tableLayout: 'fixed', width: columns.reduce((sum, c) => sum + c.width, 0) }}>
              <colgroup>
                {columns.map((c) => (<col key={c.key} style={{ width: c.width }} />))}
              </colgroup>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {columns.map((c) => (
                    <HeaderCell
                      key={c.key}
                      column={c}
                      sortDir={sort?.key === c.key ? sort.dir : null}
                      onSort={() => c.sortable && handleSort(c.key)}
                      onResize={(w) => handleResize(c.key, w)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <BoardRow
                    key={r.id}
                    row={r}
                    columns={columns}
                    titles={titles}
                    trades={trades}
                    profiles={profiles}
                    onPatch={(patch) => patchEmployee.mutate({ id: r.id, patch })}
                    onAddTimeOff={() => setTimeOffTarget({ id: r.id, name: `${r.first_name} ${r.last_name}` })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AssignDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        invalidateKeys={[['labor-board'], ['labor-summary']]}
      />

      <TimeOffDialog
        open={timeOffTarget !== null}
        onClose={() => setTimeOffTarget(null)}
        employeeId={timeOffTarget?.id}
        employeeName={timeOffTarget?.name}
        invalidateKeys={[['labor-board'], ['labor-summary'], ['labor-time-off']]}
      />
    </div>
  );
};

// ─── KPI card ──────────────────────────────────────────────────────────
const Kpi: React.FC<{ tone: 'blue' | 'green' | 'amber' | 'purple'; label: string; loader: () => Promise<string> }> = ({ tone, label }) => {
  const { data: summary } = useQuery({ queryKey: ['labor-summary'], queryFn: () => laborApi.getSummary() });
  const value = summary
    ? (label.includes('Total') ? summary.total_employees
      : label.includes('Currently') ? summary.currently_assigned
      : label.includes('Upcoming') ? summary.upcoming_assignments
      : summary.ending_within_two_weeks)
    : '—';
  return (
    <div className={`sales-kpi-card ${tone}`}>
      <div className="sales-kpi-label">{label}</div>
      <div className="sales-kpi-value">{value}</div>
    </div>
  );
};

const KpiLink: React.FC<{ tone: 'blue' | 'green' | 'amber' | 'purple'; label: string; to: string; loader: () => Promise<string> }> = ({ tone, label, to }) => {
  const { data: summary } = useQuery({ queryKey: ['labor-summary'], queryFn: () => laborApi.getSummary() });
  const value = summary?.unfilled_roles ?? '—';
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div className={`sales-kpi-card ${tone}`} style={{ cursor: 'pointer' }}>
        <div className="sales-kpi-label">{label}</div>
        <div className="sales-kpi-value">{value}</div>
      </div>
    </Link>
  );
};

// ─── HeaderCell with sort indicator + right-edge resize handle ─────────
const HeaderCell: React.FC<{
  column: ColumnDef;
  sortDir: 'asc' | 'desc' | null;
  onSort: () => void;
  onResize: (newWidth: number) => void;
}> = ({ column, sortDir, onSort, onResize }) => {
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startW.current = column.width;

    const onMove = (ev: MouseEvent) => {
      onResize(startW.current + (ev.clientX - startX.current));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <th
      style={{
        padding: '0.6rem 0.75rem',
        textAlign: 'left',
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        color: '#475569',
        fontWeight: 600,
        letterSpacing: 0.5,
        cursor: column.sortable ? 'pointer' : 'default',
        userSelect: 'none',
        position: 'relative',
        whiteSpace: 'nowrap',
      }}
      onClick={(e) => {
        // Don't sort when clicking the resize handle.
        if ((e.target as HTMLElement).dataset.resizeHandle) return;
        onSort();
      }}
    >
      {column.label}
      {sortDir && (
        <span style={{ marginLeft: 4, color: '#002356' }}>
          {sortDir === 'asc' ? '▲' : '▼'}
        </span>
      )}
      <span
        data-resize-handle="1"
        onMouseDown={onMouseDown}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#94a3b8'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#e2e8f0'; }}
        style={{
          position: 'absolute',
          right: 0,
          top: '15%',
          bottom: '15%',
          width: 2,
          cursor: 'col-resize',
          background: '#e2e8f0',
          borderRadius: 1,
        }}
      />
    </th>
  );
};

// ─── Row + Editable cells ──────────────────────────────────────────────
const BoardRow: React.FC<{
  row: LaborBoardRow;
  columns: ColumnDef[];
  titles: string[];
  trades: string[];
  profiles: string[];
  onPatch: (patch: Partial<{ trade: string | null; employee_group: string | null; title: string | null; profile_type: string | null; phone: string | null }>) => void;
  onAddTimeOff: () => void;
}> = ({ row, columns, titles, trades, profiles, onPatch, onAddTimeOff }) => {
  const initials = `${row.first_name?.[0] || ''}${row.last_name?.[0] || ''}`.toUpperCase();

  const renderCell = (c: ColumnDef) => {
    switch (c.key) {
      case 'name':
        return (
          <Link
            to={`/labor/employee/${row.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: colorFor(row.id), color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.75rem', flexShrink: 0,
            }}>{initials}</div>
            <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.first_name} {row.last_name}
            </span>
          </Link>
        );
      case 'availability': {
        let badge: React.ReactNode;
        if (row.availability === 'time_off' && row.time_off_type) {
          const colors = TIME_OFF_COLORS[row.time_off_type as TimeOffType];
          badge = (
            <span style={{ ...pill, background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>
              {TIME_OFF_LABELS[row.time_off_type as TimeOffType]}
              {row.time_off_end_date ? ` · until ${fmtDate(row.time_off_end_date)}` : ''}
            </span>
          );
        } else if (row.availability === 'available') {
          badge = <span style={{ ...pill, background: '#dcfce7', color: '#15803d' }}>Available</span>;
        } else {
          badge = (
            <span style={{ ...pill, background: '#dbeafe', color: '#1d4ed8' }}>
              Assigned{row.current_end_date ? ` · until ${fmtDate(row.current_end_date)}` : ''}
            </span>
          );
        }
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {badge}
            <button
              title="Add / manage time off"
              onClick={(e) => { e.stopPropagation(); onAddTimeOff(); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.75rem', padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              +
            </button>
          </div>
        );
      }
      case 'current_project':
        if (row.current_account_id) {
          return (
            <span style={{ color: '#7c3aed' }}>
              <span style={{ fontSize: '0.65rem', background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: 4, fontWeight: 700, marginRight: 4 }}>ACCT</span>
              {row.current_project_name}
            </span>
          );
        }
        return row.current_project_id ? (
          <Link to={`/projects/${row.current_project_id}`} style={{ color: '#002356', textDecoration: 'none' }}>
            {row.current_project_name}
          </Link>
        ) : <span style={{ color: '#cbd5e1' }}>—</span>;
      case 'next_project':
        if (row.next_account_id) {
          return (
            <span style={{ color: '#7c3aed' }}>
              <span style={{ fontSize: '0.65rem', background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: 4, fontWeight: 700, marginRight: 4 }}>ACCT</span>
              {row.next_project_name}
              {row.next_start_date && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Starts {fmtDate(row.next_start_date)}</div>}
            </span>
          );
        }
        return row.next_project_id ? (
          <Link to={`/projects/${row.next_project_id}`} style={{ color: '#002356', textDecoration: 'none' }}>
            {row.next_project_name}
            {row.next_start_date && (
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Starts {fmtDate(row.next_start_date)}</div>
            )}
          </Link>
        ) : <span style={{ color: '#cbd5e1' }}>—</span>;
      case 'title':
        return (
          <EditableCell
            value={row.title || row.job_title || ''}
            options={titles}
            allowFreeText={false}
            placeholder="set title"
            onSave={(v) => onPatch({ title: v || null })}
          />
        );
      case 'trade':
        return (
          <EditableCell
            value={row.trade || ''}
            options={trades}
            allowFreeText={false}
            placeholder="set trade"
            onSave={(v) => onPatch({ trade: v || null })}
          />
        );
      case 'employee_group':
        return (
          <EditableCell
            value={row.employee_group || ''}
            options={[]}
            allowFreeText
            placeholder="set group"
            onSave={(v) => onPatch({ employee_group: v || null })}
          />
        );
      case 'profile_type':
        return (
          <EditableCell
            value={row.profile_type || ''}
            options={profiles}
            allowFreeText={false}
            placeholder="set type"
            onSave={(v) => onPatch({ profile_type: v || null })}
          />
        );
      case 'phone':
        return (
          <EditableCell
            value={row.mobile_phone || row.phone || ''}
            options={[]}
            allowFreeText
            placeholder="set phone"
            displayFormat={fmtPhone}
            onSave={(v) => onPatch({ phone: v || null })}
            type="tel"
          />
        );
    }
  };

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
      {columns.map((c) => (
        <td
          key={c.key}
          style={{
            padding: '0.6rem 0.75rem',
            verticalAlign: 'middle',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {renderCell(c)}
        </td>
      ))}
    </tr>
  );
};

const EditableCell: React.FC<{
  value: string;
  options: string[];
  allowFreeText: boolean;
  placeholder: string;
  type?: string;
  displayFormat?: (raw: string) => string;
  onSave: (next: string) => void;
}> = ({ value, options, allowFreeText, placeholder, type, displayFormat, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{
          cursor: 'pointer',
          display: 'block',
          color: value ? '#1e293b' : '#cbd5e1',
          fontStyle: value ? 'normal' : 'italic',
          padding: '2px 4px',
          margin: '-2px -4px',
          borderRadius: 4,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        title="Click to edit"
      >
        {value ? (displayFormat ? displayFormat(value) : value) : placeholder}
      </span>
    );
  }

  if (options.length > 0 && !allowFreeText) {
    return (
      <select
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
        style={inputStyle}
      >
        <option value="">—</option>
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
    );
  }

  return (
    <input
      autoFocus
      type={type || 'text'}
      value={draft}
      list={options.length > 0 ? `opts-${placeholder}` : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const fmtPhone = (raw: string): string => {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  if (digits.length === 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return raw;
};

const pill: React.CSSProperties = { display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '2px 4px', fontSize: '0.85rem',
  border: '1px solid #002356', borderRadius: 4, background: 'white', boxSizing: 'border-box',
};

export default LaborBoard;
