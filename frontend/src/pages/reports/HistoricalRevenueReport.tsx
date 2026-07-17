import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  historicalRevenueApi,
  GroupByOption,
  MetricOption,
  HistoricalRevenueRow,
  HistoricalRevenueTeam,
} from '../../services/historicalRevenueReport';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ── Palette ───────────────────────────────────────────────────────────────────

const PALETTE = [
  '#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#E11D48', '#7C3AED', '#0EA5E9', '#CA8A04',
  '#16A34A', '#DC2626', '#9333EA', '#0284C7', '#D97706',
];

function colorFor(idx: number): string {
  return PALETTE[idx % PALETTE.length];
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v));

const fmtM = (v: number) => {
  if (v === 0) return '$0';
  const a = Math.abs(v);
  if (a >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return fmt(v);
};

// ── Label maps ────────────────────────────────────────────────────────────────

const GROUP_BY_LABELS: Record<GroupByOption, string> = {
  market: 'Market',
  department: 'Department',
  pm: 'Project Manager',
  customer: 'Customer',
};

const METRIC_LABELS: Record<MetricOption, string> = {
  contract_amount: 'Contract Value',
  earned_revenue: 'Earned Revenue',
  billed_amount: 'Billed Amount',
};

// ── Main component ────────────────────────────────────────────────────────────

const HistoricalRevenueReport: React.FC = () => {
  const [groupBy, setGroupBy] = useState<GroupByOption>('market');
  const [metric, setMetric] = useState<MetricOption>('contract_amount');

  // year range
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(currentYear - 5);
  const [endYear, setEndYear] = useState(currentYear);

  // filters
  const [markets, setMarkets] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [pms, setPms] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [teams, setTeams] = useState<number[]>([]);

  const { data: filtersData } = useQuery({
    queryKey: ['historicalRevenueFilters'],
    queryFn: () => historicalRevenueApi.getFilters().then(r => r.data),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['historicalRevenue', groupBy, startYear, endYear, markets, departments, pms, customers, teams],
    queryFn: () => historicalRevenueApi.get({
      groupBy, startYear, endYear,
      markets, departments, pms, customers, teams,
    }).then(r => r.data),
  });

  // ── Derived chart data ────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    if (!data) return null;
    const { years, groups, data: rows } = data;

    const lookup = new Map<string, HistoricalRevenueRow>();
    for (const row of rows) lookup.set(`${row.year}::${row.group_value}`, row);

    const datasets = groups.map((g, idx) => ({
      label: g,
      backgroundColor: colorFor(idx),
      data: years.map(yr => {
        const row = lookup.get(`${yr}::${g}`);
        return row ? row[metric] : 0;
      }),
      stack: 'revenue',
    }));

    return { labels: years.map(String), datasets };
  }, [data, metric]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { font: { size: 11 }, padding: 14, boxWidth: 12 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}`,
          footer: (items: any[]) => {
            const total = items.reduce((s: number, i: any) => s + (i.raw || 0), 0);
            return `Total: ${fmt(total)}`;
          },
        },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
      y: {
        stacked: true,
        ticks: { callback: (v: any) => fmtM(v), font: { size: 10 } },
        grid: { color: '#F1F5F9' },
      },
    },
  }), []);

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const topGroup = useMemo(() => {
    if (!data || !data.groups.length) return null;
    const totals: Record<string, number> = {};
    for (const row of data.data) {
      totals[row.group_value] = (totals[row.group_value] || 0) + row[metric];
    }
    return Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  }, [data, metric]);

  // ── Year options for range selects ────────────────────────────────────────

  const allAvailableYears = useMemo(() => {
    if (!filtersData?.years.length) {
      return Array.from({ length: 10 }, (_, i) => currentYear - 9 + i);
    }
    return filtersData.years;
  }, [filtersData, currentYear]);

  const activeFiltersCount = markets.length + departments.length + pms.length + customers.length + teams.length;

  return (
    <div style={{ padding: '1rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <Link to="/reports" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.85rem' }}>
            &larr; Reports
          </Link>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.3rem', color: '#1e293b' }}>
            Historical Revenue
          </h2>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Stacked revenue by year — broken down by {GROUP_BY_LABELS[groupBy].toLowerCase()}.
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '0.85rem', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>

          {/* Stack by */}
          <ControlGroup label="Stack by">
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as GroupByOption)}
              style={selectStyle}
            >
              {(Object.keys(GROUP_BY_LABELS) as GroupByOption[]).map(k => (
                <option key={k} value={k}>{GROUP_BY_LABELS[k]}</option>
              ))}
            </select>
          </ControlGroup>

          {/* Metric */}
          <ControlGroup label="Revenue metric">
            <select
              value={metric}
              onChange={e => setMetric(e.target.value as MetricOption)}
              style={selectStyle}
            >
              {(Object.keys(METRIC_LABELS) as MetricOption[]).map(k => (
                <option key={k} value={k}>{METRIC_LABELS[k]}</option>
              ))}
            </select>
          </ControlGroup>

          {/* Year range */}
          <ControlGroup label="From year">
            <select value={startYear} onChange={e => setStartYear(Number(e.target.value))} style={selectStyle}>
              {allAvailableYears.filter(y => y <= endYear).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </ControlGroup>

          <ControlGroup label="To year">
            <select value={endYear} onChange={e => setEndYear(Number(e.target.value))} style={selectStyle}>
              {allAvailableYears.filter(y => y >= startYear).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </ControlGroup>

          {/* Divider */}
          <div style={{ height: 32, width: 1, background: '#e2e8f0', flexShrink: 0 }} />

          {/* Filters */}
          {filtersData && (
            <>
              {filtersData.markets.length > 0 && (
                <FilterDropdown
                  label="Market"
                  selected={markets}
                  options={filtersData.markets.map(m => ({ key: m, label: m }))}
                  onToggle={v => setMarkets(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
                  onClear={() => setMarkets([])}
                />
              )}
              {filtersData.departments.length > 0 && (
                <FilterDropdown
                  label="Department"
                  selected={departments}
                  options={filtersData.departments.map(d => ({ key: d, label: d }))}
                  onToggle={v => setDepartments(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
                  onClear={() => setDepartments([])}
                />
              )}
              {filtersData.pms.length > 0 && (
                <FilterDropdown
                  label="Project Manager"
                  selected={pms}
                  options={filtersData.pms.map(pm => ({ key: pm, label: pm }))}
                  onToggle={v => setPms(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
                  onClear={() => setPms([])}
                />
              )}
              {filtersData.customers.length > 0 && (
                <FilterDropdown
                  label="Customer"
                  selected={customers}
                  options={filtersData.customers.map(c => ({ key: c, label: c }))}
                  onToggle={v => setCustomers(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])}
                  onClear={() => setCustomers([])}
                  searchable
                />
              )}
              {filtersData.teams.length > 0 && (
                <FilterDropdown
                  label="Team"
                  selected={teams.map(String)}
                  options={filtersData.teams.map((t: HistoricalRevenueTeam) => ({ key: String(t.id), label: t.name, color: t.color }))}
                  onToggle={v => { const n = Number(v); setTeams(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n]); }}
                  onClear={() => setTeams([])}
                />
              )}
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => { setMarkets([]); setDepartments([]); setPms([]); setCustomers([]); setTeams([]); }}
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', border: '1px solid #fca5a5', borderRadius: 6, background: '#fef2f2', color: '#b91c1c', cursor: 'pointer' }}
                >
                  Clear all ({activeFiltersCount})
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isLoading && <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>}
      {error && <div className="card" style={{ padding: '1.5rem', color: '#b91c1c' }}>Failed to load report data.</div>}

      {data && (
        <>
          {/* KPI strip */}
          <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
            <Kpi label={`Total ${METRIC_LABELS[metric]}`} value={fmtM(data.grand_total)} color="#1e293b" bold />
            <Kpi label="Total Contracts" value={data.total_contracts.toLocaleString()} color="#475569" />
            <Kpi label="Years Shown" value={`${data.years[0] ?? '—'} – ${data.years[data.years.length - 1] ?? '—'}`} color="#475569" />
            <Kpi label={`${GROUP_BY_LABELS[groupBy]} Groups`} value={String(data.groups.length)} color="#475569" />
            {topGroup && (
              <Kpi label={`Top ${GROUP_BY_LABELS[groupBy]}`} value={topGroup[0]} color="#2563eb" />
            )}
            {topGroup && (
              <Kpi label="Top Group Revenue" value={fmtM(topGroup[1])} color="#2563eb" />
            )}
          </div>

          {/* Chart */}
          <div className="card" style={{ padding: '1rem', marginBottom: '0.85rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
              {METRIC_LABELS[metric]} by Year — Stacked by {GROUP_BY_LABELS[groupBy]}
            </div>
            <div style={{ height: 380 }}>
              {chartData && <Bar data={chartData} options={chartOptions} />}
            </div>
          </div>

          {/* Detail table */}
          <DetailTable data={data.data} years={data.years} groups={data.groups} metric={metric} totalsByYear={data.totals_by_year} />

          <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
            Generated {new Date(data.generated_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.
            Grouped by contract start month. Showing {METRIC_LABELS[metric].toLowerCase()}.
          </div>
        </>
      )}
    </div>
  );
};

// ── Detail table ──────────────────────────────────────────────────────────────

const DetailTable: React.FC<{
  data: HistoricalRevenueRow[];
  years: number[];
  groups: string[];
  metric: MetricOption;
  totalsByYear: Record<number, number>;
}> = ({ data, years, groups, metric, totalsByYear }) => {
  const [open, setOpen] = useState(true);

  const lookup = useMemo(() => {
    const m = new Map<string, HistoricalRevenueRow>();
    for (const row of data) m.set(`${row.year}::${row.group_value}`, row);
    return m;
  }, [data]);

  const groupTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const row of data) {
      t[row.group_value] = (t[row.group_value] || 0) + row[metric];
    }
    return t;
  }, [data, metric]);

  const grandTotal = useMemo(() => Object.values(groupTotals).reduce((s, v) => s + v, 0), [groupTotals]);

  return (
    <div className="card" style={{ padding: 0, marginBottom: '1.25rem', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.65rem 0.85rem', background: '#f8fafc', border: 'none',
          borderBottom: open ? '2px solid #2563eb' : 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e3a5f' }}>Detail Breakdown</span>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </button>
      {open && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={{ background: '#1E3A5F' }}>
                <th style={{ ...th, textAlign: 'left', minWidth: 180 }}>Group</th>
                {years.map(y => <th key={y} style={th}>{y}</th>)}
                <th style={{ ...th, borderLeft: '2px solid #334155' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g, gi) => {
                const rowTotal = groupTotals[g] || 0;
                return (
                  <tr key={g} style={{ background: gi % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 600, color: '#1e293b' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: colorFor(gi), marginRight: 6, flexShrink: 0 }} />
                      {g}
                    </td>
                    {years.map(yr => {
                      const row = lookup.get(`${yr}::${g}`);
                      const val = row ? row[metric] : 0;
                      return (
                        <td key={yr} style={{ ...td, color: val > 0 ? '#1e293b' : '#cbd5e1' }}>
                          {val > 0 ? fmt(Math.round(val)) : '—'}
                        </td>
                      );
                    })}
                    <td style={{ ...td, fontWeight: 700, borderLeft: '2px solid #e2e8f0' }}>{fmt(Math.round(rowTotal))}</td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr style={{ background: '#1e293b' }}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: '#fff' }}>Total</td>
                {years.map(yr => (
                  <td key={yr} style={{ ...td, fontWeight: 700, color: '#fff' }}>{fmt(Math.round(totalsByYear[yr] || 0))}</td>
                ))}
                <td style={{ ...td, fontWeight: 800, color: '#fff', borderLeft: '2px solid #334155' }}>{fmt(Math.round(grandTotal))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const ControlGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
    {children}
  </div>
);

const FilterDropdown: React.FC<{
  label: string;
  selected: string[];
  options: { key: string; label: string; color?: string }[];
  onToggle: (key: string) => void;
  onClear: () => void;
  searchable?: boolean;
}> = ({ label, selected, options, onToggle, onClear, searchable }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = searchable && search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const triggerLabel = selected.length === 0
    ? label
    : `${label} (${selected.length})`;

  const isActive = selected.length > 0;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: '0.78rem', padding: '0.32rem 0.65rem', borderRadius: 6,
          border: isActive ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
          background: isActive ? '#eff6ff' : '#fff',
          color: isActive ? '#1e40af' : '#475569',
          cursor: 'pointer', fontWeight: isActive ? 600 : 400,
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          whiteSpace: 'nowrap',
        }}
      >
        {triggerLabel}
        <span style={{ fontSize: '0.55rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 180, maxHeight: 280,
          overflowY: 'auto', padding: '0.25rem 0',
        }}>
          {searchable && (
            <div style={{ padding: '0.35rem 0.6rem', borderBottom: '1px solid #f1f5f9' }}>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                style={{ width: '100%', fontSize: '0.78rem', border: '1px solid #e2e8f0', borderRadius: 4, padding: '0.25rem 0.4rem', outline: 'none' }}
              />
            </div>
          )}
          <button onClick={() => { onClear(); setOpen(false); }} style={ddItem(selected.length === 0)}>
            All
          </button>
          {filtered.map(opt => (
            <button key={opt.key} onClick={() => onToggle(opt.key)} style={ddItem(selected.includes(opt.key))}>
              {opt.color && (
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
              )}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
              {selected.includes(opt.key) && <span style={{ color: '#2563eb', fontSize: '0.75rem' }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string; color: string; bold?: boolean }> = ({ label, value, color, bold }) => (
  <div>
    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.2rem', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: '1.05rem', fontWeight: bold ? 800 : 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

// ── Styles ────────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  padding: '0.3rem 0.55rem',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  background: '#fff',
  color: '#1e293b',
  cursor: 'pointer',
  outline: 'none',
};

const th: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontWeight: 700,
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  textAlign: 'right',
  color: '#fff',
  borderBottom: '2px solid #334155',
  whiteSpace: 'nowrap',
  letterSpacing: '0.03em',
};

const td: React.CSSProperties = {
  padding: '0.38rem 0.75rem',
  textAlign: 'right',
  borderBottom: '1px solid #f1f5f9',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const ddItem = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  width: '100%', padding: '0.38rem 0.75rem',
  border: 'none', background: active ? '#eff6ff' : 'transparent',
  color: active ? '#1e40af' : '#374151',
  fontSize: '0.78rem', fontWeight: active ? 600 : 400,
  cursor: 'pointer', textAlign: 'left',
});

export default HistoricalRevenueReport;
