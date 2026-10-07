import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import PieChartIcon from '@mui/icons-material/PieChart';
import { companyHealthApi, BacklogByMarket } from '../../../services/companyHealth';
import { WidgetProps } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = [
  '#002356', '#0057b8', '#2196F3', '#4CAF50',
  '#FF9800', '#9C27B0', '#E91E63', '#00BCD4',
  '#FF5722', '#607D8B', '#8BC34A', '#FFC107',
];

const fmtM = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const BacklogByMarketWidget: React.FC<WidgetProps> = () => {
  const { data } = useQuery({
    queryKey: ['company-health'],
    queryFn: () => companyHealthApi.get().then(r => r.data),
  });

  const markets: BacklogByMarket[] = (data?.backlog_by_market ?? []).filter(m => m.backlog > 0);
  const total = markets.reduce((s, m) => s + m.backlog, 0);

  const chartData = {
    labels: markets.map(m => m.market),
    datasets: [{
      data: markets.map(m => m.backlog),
      backgroundColor: COLORS.slice(0, markets.length),
      borderColor: '#ffffff',
      borderWidth: 2,
    }],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw as number;
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
            return ` ${fmtM(val)}  (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <h2 className="card-title">
          <PieChartIcon className="card-title-icon" />
          Backlog by Market
        </h2>
      </div>
      {markets.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No backlog data
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '0.75rem', padding: '0.75rem' }}>
          {/* Pie */}
          <div style={{ flex: '0 0 45%', minHeight: 0, position: 'relative' }}>
            <Pie data={chartData} options={options} />
          </div>
          {/* Custom legend */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', justifyContent: 'center' }}>
            {markets.map((m, i) => (
              <div key={m.market} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.5rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i], flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.market}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{fmtM(m.backlog)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BacklogByMarketWidget;
