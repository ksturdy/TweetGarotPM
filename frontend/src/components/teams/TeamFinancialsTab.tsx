import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { teamsApi, TeamFinancials, TeamProject } from '../../services/teams';

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
