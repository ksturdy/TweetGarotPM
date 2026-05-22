import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { cashFlowReportApi, GmTrendProject } from '../../../services/cashFlowReport';
import { WidgetProps } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const fmtPct = (v: number | null | undefined, digits = 1) => {
  if (v == null || Number.isNaN(Number(v))) return '-';
  return `${(Number(v) * 100).toFixed(digits)}%`;
};

const fmtSignedPctPoints = (v: number | null | undefined, digits = 1) => {
  if (v == null || Number.isNaN(Number(v))) return '-';
  const pts = Number(v) * 100;
  const sign = pts > 0 ? '+' : '';
  return `${sign}${pts.toFixed(digits)}%`;
};

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '-';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const fmtMoney = (v: number | null | undefined) => {
  if (v == null || Number.isNaN(Number(v))) return '-';
  const n = Math.round(Number(v));
  const abs = Math.abs(n).toLocaleString('en-US');
  return n < 0 ? `-$${abs}` : `$${abs}`;
};

const fmtSignedMoney = (v: number | null | undefined) => {
  if (v == null || Number.isNaN(Number(v))) return '-';
  const n = Math.round(Number(v));
  const abs = Math.abs(n).toLocaleString('en-US');
  if (n > 0) return `+$${abs}`;
  if (n < 0) return `-$${abs}`;
  return `$${abs}`;
};

export interface GmTrendRankConfig {
  title: string;
  icon: React.ReactNode;
  direction: 'down' | 'up';
  backgroundColor: string;
  borderColor: string;
  emptyMessages: { my: string; team: string; default: string };
}

interface Props extends WidgetProps {
  config: GmTrendRankConfig;
}

const GmTrendRankWidget: React.FC<Props> = ({
  viewScope,
  currentEmployeeId,
  teamMemberEmployeeIds,
  config,
}) => {
  const navigate = useNavigate();

  const { data: allProjects, isLoading } = useQuery({
    queryKey: ['gm-trend-report'],
    queryFn: () => cashFlowReportApi.getGmTrend(),
  });

  const ranked = React.useMemo(() => {
    if (!allProjects) return [] as GmTrendProject[];

    const teamIds = teamMemberEmployeeIds.map(Number);
    const scoped = allProjects.filter((p) => {
      switch (viewScope) {
        case 'my':
          return Number(p.manager_id) === Number(currentEmployeeId);
        case 'team':
          return teamIds.includes(Number(p.manager_id));
        case 'company':
        default:
          return true;
      }
    });

    const filtered = scoped.filter((p) => {
      if (p.status !== 'Open' && p.status !== 'Soft-Closed') return false;
      const delta = Number(p.gm_delta);
      if (Number.isNaN(delta)) return false;
      return config.direction === 'down' ? delta < 0 : delta > 0;
    });

    return filtered
      .sort((a, b) => (config.direction === 'down'
        ? Number(a.gm_delta) - Number(b.gm_delta)
        : Number(b.gm_delta) - Number(a.gm_delta)))
      .slice(0, 10);
  }, [allProjects, viewScope, currentEmployeeId, teamMemberEmployeeIds, config.direction]);

  const chartData = React.useMemo(() => ({
    labels: ranked.map((p) => p.name),
    datasets: [
      {
        label: 'GM% change (pts)',
        data: ranked.map((p) => Number(p.gm_delta) * 100),
        backgroundColor: config.backgroundColor,
        borderColor: config.borderColor,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }), [ranked, config.backgroundColor, config.borderColor]);

  const chartOptions = React.useMemo(() => ({
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const pts = Number(ctx.parsed.x);
            const sign = pts > 0 ? '+' : '';
            return `${sign}${pts.toFixed(1)}%`;
          },
          afterLabel: (ctx: any) => {
            const p = ranked[ctx.dataIndex];
            if (!p) return '';
            const lines: string[] = [];
            if (p.manager_name) lines.push(`PM: ${p.manager_name}`);
            lines.push(`Contract Value: ${fmtMoney(p.contract_value)}`);
            lines.push(`Latest GM: ${fmtPct(p.latest_gm_percent)} (${fmtDate(p.latest_date)})`);
            lines.push(`Prior GM: ${fmtPct(p.prior_gm_percent)} (${fmtDate(p.prior_date)})`);
            lines.push(`Change: ${fmtSignedPctPoints(p.gm_delta)} / ${fmtSignedMoney(p.gm_dollar_delta)}`);
            return lines.join('\n');
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          callback: (v: any) => {
            const n = Number(v);
            const sign = n > 0 ? '+' : '';
            return `${sign}${n.toFixed(1)}`;
          },
          font: { size: 10 },
          maxTicksLimit: 5,
        },
        grid: { color: '#e5e7eb' },
      },
      y: {
        ticks: {
          font: { size: 11 },
          callback: function (this: any, _value: any, index: number) {
            const label = (this.getLabelForValue ? this.getLabelForValue(index) : ranked[index]?.name) || '';
            return String(label).length > 28 ? `${String(label).slice(0, 26)}…` : String(label);
          },
        },
        grid: { display: false },
      },
    },
    onClick: (_evt: any, elements: any[]) => {
      if (!elements?.length) return;
      const idx = elements[0].index;
      const project = ranked[idx];
      if (project) navigate(`/projects/${project.id}`);
    },
  }), [ranked, navigate]);

  const chartHeight = Math.max(160, ranked.length * 20 + 30);

  const emptyMessage =
    viewScope === 'my' ? config.emptyMessages.my :
    viewScope === 'team' ? config.emptyMessages.team :
    config.emptyMessages.default;

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2 className="card-title">
          {config.icon}
          {config.title}
        </h2>
      </div>
      <div className="dashboard-scrollable" style={{ padding: '0.5rem 0' }}>
        {isLoading ? (
          <div className="empty-table" style={{ padding: '2rem 0', textAlign: 'center', color: '#8888a0' }}>
            Loading…
          </div>
        ) : ranked.length === 0 ? (
          <div className="empty-table" style={{ padding: '2rem 0', textAlign: 'center', color: '#8888a0' }}>
            {emptyMessage}
          </div>
        ) : (
          <div style={{ height: chartHeight, width: '100%' }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        )}
      </div>
    </div>
  );
};

export default GmTrendRankWidget;
