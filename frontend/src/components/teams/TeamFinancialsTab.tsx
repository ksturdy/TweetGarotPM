import React from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { teamsApi, TeamFinancials } from '../../services/teams';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

function fmtM(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

interface BarTableRow {
  label: string;
  contract_value: number;
  backlog?: number;
  gm_pct?: number | null;
  project_count: number;
}

const BarTable: React.FC<{ rows: BarTableRow[]; color: string; showGm?: boolean }> = ({ rows, color, showGm = true }) => {
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
          <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
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
  const { data: fin, isLoading } = useQuery<TeamFinancials>({
    queryKey: ['teams', teamId, 'financials', selectedStatuses],
    queryFn: () => teamsApi.getFinancials(teamId, selectedStatuses),
    enabled: !!teamId && selectedStatuses.length > 0,
  });

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

  const lineOpts = (yLabel: string, yFmt: (v: any) => string) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
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
    interaction: { mode: 'index' as const, intersect: false },
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

      {/* Market + Manager side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <Card title="Revenue by Market">
          {(fin?.by_market || []).length > 0 ? (
            <BarTable
              rows={(fin?.by_market || []).map(r => ({ label: r.market, ...r }))}
              color={accentColor}
            />
          ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
        </Card>

        <Card title="Revenue by Project Manager">
          {(fin?.by_manager || []).length > 0 ? (
            <BarTable
              rows={(fin?.by_manager || []).map(r => ({ label: r.manager_name, ...r }))}
              color={accentColor}
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
          />
        ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
      </Card>

      {/* Yearly History */}
      <Card title="Revenue History by Year">
        {(fin?.by_year || []).length > 0 ? (
          <div style={{ position: 'relative', height: '280px' }}>
            <Chart type="bar" data={yearlyChartData} options={{ ...yearlyChartOptions, maintainAspectRatio: false }} />
          </div>
        ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
      </Card>

      {/* Revenue by Year by PM + Market */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <Card title="Revenue by Year — Project Manager">
          {byYearManagerChart.datasets.length > 0 ? (
            <div style={{ position: 'relative', height: '300px' }}>
              <Chart type="line" data={byYearManagerChart} options={lineOpts('Revenue', fmtM)} />
            </div>
          ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
        </Card>

        <Card title="Revenue by Year — Market">
          {byYearMarketChart.datasets.length > 0 ? (
            <div style={{ position: 'relative', height: '300px' }}>
              <Chart type="line" data={byYearMarketChart} options={lineOpts('Revenue', fmtM)} />
            </div>
          ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
        </Card>
      </div>

      {/* Top Customers — Revenue + Margin by Year */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <Card title="Top Customers — Revenue by Year">
          {byYearCustomerRevenueChart.datasets.length > 0 ? (
            <div style={{ position: 'relative', height: '300px' }}>
              <Chart type="line" data={byYearCustomerRevenueChart} options={lineOpts('Revenue', fmtM)} />
            </div>
          ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
        </Card>

        <Card title="Top Customers — GM% by Year">
          {byYearCustomerGmChart.datasets.length > 0 ? (
            <div style={{ position: 'relative', height: '300px' }}>
              <Chart type="line" data={byYearCustomerGmChart} options={lineOpts('GM%', (v: any) => `${v}%`)} />
            </div>
          ) : <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>No data</div>}
        </Card>
      </div>

    </div>
  );
};

export default TeamFinancialsTab;
