import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { cashFlowReportApi, CashFlowProject } from '../../../services/cashFlowReport';
import { WidgetProps } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const fmtMoney = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
};

export type CashFlowMetric = 'cash_flow' | 'backlog' | 'gross_profit_dollars';

export interface CashFlowRankConfig {
  title: string;
  icon: React.ReactNode;
  metric: CashFlowMetric;
  direction: 'asc' | 'desc';
  predicate?: (value: number) => boolean;
  datasetLabel: string;
  backgroundColor: string;
  borderColor: string;
  emptyMessages: { my: string; team: string; default: string };
  viewReportLink?: string;
  viewReportLabel?: string;
}

interface Props extends WidgetProps {
  config: CashFlowRankConfig;
}

const CashFlowRankWidget: React.FC<Props> = ({
  viewScope,
  currentEmployeeId,
  teamMemberEmployeeIds,
  config,
}) => {
  const navigate = useNavigate();

  const { data: allProjects, isLoading } = useQuery({
    queryKey: ['cash-flow-report'],
    queryFn: () => cashFlowReportApi.getData(),
  });

  const ranked = React.useMemo(() => {
    if (!allProjects) return [] as CashFlowProject[];

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

    const valueOf = (p: CashFlowProject): number | null => {
      const raw = p[config.metric];
      if (raw == null) return null;
      const n = Number(raw);
      if (Number.isNaN(n)) return null;
      if (config.predicate && !config.predicate(n)) return null;
      return n;
    };

    return scoped
      .filter((p) => p.status === 'Open' || p.status === 'Soft-Closed')
      .map((p) => ({ p, v: valueOf(p) }))
      .filter((x): x is { p: CashFlowProject; v: number } => x.v !== null)
      .sort((a, b) => (config.direction === 'asc' ? a.v - b.v : b.v - a.v))
      .slice(0, 10)
      .map((x) => x.p);
  }, [allProjects, viewScope, currentEmployeeId, teamMemberEmployeeIds, config.metric, config.direction, config.predicate]);

  const chartData = React.useMemo(() => ({
    labels: ranked.map((p) => p.name),
    datasets: [
      {
        label: config.datasetLabel,
        data: ranked.map((p) => Number(p[config.metric] ?? 0)),
        backgroundColor: config.backgroundColor,
        borderColor: config.borderColor,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  }), [ranked, config.metric, config.datasetLabel, config.backgroundColor, config.borderColor]);

  const chartOptions = React.useMemo(() => ({
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => fmtMoney(Number(ctx.parsed.x)),
          afterLabel: (ctx: any) => {
            const p = ranked[ctx.dataIndex];
            if (!p) return '';
            const lines: string[] = [];
            if (p.manager_name) lines.push(`PM: ${p.manager_name}`);
            if (p.contract_value != null) lines.push(`Contract: ${fmtMoney(Number(p.contract_value))}`);
            if (p.cash_flow != null) lines.push(`Cash Flow: ${fmtMoney(Number(p.cash_flow))}`);
            if (p.backlog != null) lines.push(`Backlog: ${fmtMoney(Number(p.backlog))}`);
            if (p.gross_profit_dollars != null) lines.push(`GM $: ${fmtMoney(Number(p.gross_profit_dollars))}`);
            return lines.join('\n');
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          callback: (v: any) => fmtMoney(Number(v)),
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
        {config.viewReportLink && (
          <Link to={config.viewReportLink} className="card-link">
            {config.viewReportLabel || 'View report'}
          </Link>
        )}
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

export default CashFlowRankWidget;
