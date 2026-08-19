import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { projectSnapshotsApi } from '../../services/projectSnapshots';
import { format } from 'date-fns';
import { Line } from 'react-chartjs-2';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const DEFAULT_CARD_ORDER = [
  'gm-percent',
  'labor-rate',
  'revenue',
  'gm-by-complete',
  'budget-variance',
  'productivity',
  'gm-vs-complete',
  'est-revenue-cost',
];

interface SortableCardProps {
  id: string;
  title: string;
  icon: string;
  footnote?: string;
  children: React.ReactNode;
}

const SortableCard: React.FC<SortableCardProps> = ({ id, title, icon, footnote, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className="card"
      style={{
        padding: '0.75rem',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <span
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          title="Drag to reorder"
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            color: '#cbd5e1',
            fontSize: '1rem',
            lineHeight: 1,
            flexShrink: 0,
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          ⠿
        </span>
        <h3 style={{ margin: 0, fontSize: '0.85rem', color: '#475569', flex: 1 }}>
          {icon} {title}
        </h3>
      </div>
      <div style={{ height: '180px' }}>
        {children}
      </div>
      {footnote && (
        <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.35rem' }}>
          {footnote}
        </div>
      )}
    </div>
  );
};

const ProjectPerformance: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();

  const storageKey = 'performanceCardOrder';

  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        // Append any newly added cards not yet in saved order
        const merged = [...parsed, ...DEFAULT_CARD_ORDER.filter(id => !parsed.includes(id))];
        return merged;
      }
    } catch {}
    return DEFAULT_CARD_ORDER;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCardOrder(prev => {
        const oldIndex = prev.indexOf(String(active.id));
        const newIndex = prev.indexOf(String(over.id));
        const next = arrayMove(prev, oldIndex, newIndex);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    }
  };

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(res => res.data),
  });

  const { data: snapshots = [], isLoading: isLoadingSnapshots } = useQuery({
    queryKey: ['projectSnapshots', projectId],
    queryFn: () => projectSnapshotsApi.getAll(Number(projectId!)).then(res => res.data),
    enabled: !!projectId,
  });

  const dates = snapshots.map(s => {
    if (!s.snapshot_date) return '';
    const d = new Date(String(s.snapshot_date).slice(0, 10) + 'T00:00:00');
    return isNaN(d.getTime()) ? '' : format(d, 'MMM d');
  });
  const hasData = snapshots.length > 0;

  const targetMarginPct = (() => {
    if (project?.override_original_estimated_margin_pct != null && project.override_original_estimated_margin_pct !== 0) {
      return Number(project.override_original_estimated_margin_pct) * 100;
    }
    for (let i = snapshots.length - 1; i >= 0; i--) {
      const val = snapshots[i].original_estimated_margin_pct;
      if (val != null && val !== 0) return Number(val) * 100;
    }
    return 0;
  })();

  const gmPercentData = {
    labels: dates,
    datasets: [
      {
        label: 'Actual GM%',
        data: snapshots.map(s => (s.gross_profit_percent || 0) * 100),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Estimated GM%',
        data: snapshots.map(() => targetMarginPct),
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0,
      },
    ],
  };

  const laborRateData = {
    labels: dates,
    datasets: [
      {
        label: 'Actual Labor Rate',
        data: snapshots.map(s => s.actual_labor_rate || 0),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Estimated Rate',
        data: snapshots.map(s => s.estimated_labor_rate || 0),
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0,
      },
    ],
  };

  const revenueData = {
    labels: dates,
    datasets: [
      {
        label: 'Earned Revenue',
        data: snapshots.map(s => s.earned_revenue || 0),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Projected Revenue',
        data: snapshots.map(s => s.projected_revenue || 0),
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.3,
      },
    ],
  };

  const gmByPercentCompleteData = {
    labels: snapshots.map(s => `${((s.percent_complete || 0) * 100).toFixed(0)}%`),
    datasets: [
      {
        label: 'Actual GM%',
        data: snapshots.map(s => (s.gross_profit_percent || 0) * 100),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Estimated GM%',
        data: snapshots.map(() => targetMarginPct),
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0,
      },
    ],
  };

  const gmVsCompleteData = {
    labels: dates,
    datasets: [
      {
        label: 'GM% × % Complete',
        data: snapshots.map(s => {
          const gmPct = (s.gross_profit_percent || 0) * 100;
          const complete = (s.percent_complete || 0) * 100;
          return (gmPct * complete) / 100;
        }),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const costVarianceData = {
    labels: dates,
    datasets: [
      {
        label: 'Budget Variance %',
        data: snapshots.map(s => {
          if (!s.current_est_cost || !s.actual_cost || s.current_est_cost === 0) return 0;
          return ((s.current_est_cost - s.actual_cost) / s.current_est_cost) * 100;
        }),
        borderColor: '#f59e0b',
        backgroundColor: (context: any) => {
          const value = context.raw as number;
          return value >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        },
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const productivityData = {
    labels: dates,
    datasets: [
      {
        label: 'Hours per $1000 Revenue',
        data: snapshots.map(s => {
          if (!s.earned_revenue || s.earned_revenue === 0) return 0;
          return ((s.total_hours_jtd || 0) / (s.earned_revenue / 1000));
        }),
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Target',
        data: snapshots.map(s => {
          if (!s.projected_revenue || s.projected_revenue === 0) return 0;
          return ((s.total_hours_estimate || 0) / (s.projected_revenue / 1000));
        }),
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0,
      },
    ],
  };

  const estRevenueVsCostData = {
    labels: dates,
    datasets: [
      {
        label: 'Estimated Revenue',
        data: snapshots.map(s => s.projected_revenue || 0),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.3,
        fill: true,
        yAxisID: 'y',
      },
      {
        label: 'Projected Cost',
        data: snapshots.map(s => s.current_est_cost || 0),
        borderColor: '#ef4444',
        backgroundColor: 'transparent',
        borderDash: [5, 5],
        tension: 0.3,
        yAxisID: 'y',
      },
      {
        label: 'GM%',
        data: snapshots.map(s => (s.gross_profit_percent || 0) * 100),
        borderColor: '#3b82f6',
        backgroundColor: 'transparent',
        borderDash: [3, 3],
        tension: 0.3,
        yAxisID: 'y1',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: { size: 11 },
          padding: 10,
          usePointStyle: false,
          boxWidth: 20,
          boxHeight: 3,
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: { font: { size: 10 } },
      },
      x: {
        ticks: { font: { size: 10 } },
      },
    },
  };

  const percentChartOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: (value: any) => `${Number(value).toFixed(2)}%`,
        },
      },
    },
  };

  const currencyChartOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: (value: any) => {
            const num = Number(value);
            if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
            return `$${(num / 1000).toFixed(0)}K`;
          },
        },
      },
    },
  };

  const rateChartOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: {
        ...chartOptions.scales.y,
        ticks: {
          ...chartOptions.scales.y.ticks,
          callback: (value: any) => `$${value.toFixed(2)}`,
        },
      },
    },
  };

  const gmByPercentCompleteOptions = {
    ...percentChartOptions,
    scales: {
      ...percentChartOptions.scales,
      x: {
        ticks: { font: { size: 10 } },
        title: {
          display: true,
          text: '% Complete',
          font: { size: 10 },
          color: '#64748b',
        },
      },
    },
  };

  const estRevenueVsCostOptions = {
    ...chartOptions,
    scales: {
      x: { ticks: { font: { size: 10 } } },
      y: {
        type: 'linear' as const,
        position: 'left' as const,
        beginAtZero: false,
        ticks: {
          font: { size: 10 },
          callback: (value: any) => {
            const num = Number(value);
            if (Math.abs(num) >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
            return `$${(num / 1000).toFixed(0)}K`;
          },
        },
      },
      y1: {
        type: 'linear' as const,
        position: 'right' as const,
        beginAtZero: false,
        grid: { drawOnChartArea: false },
        ticks: {
          font: { size: 10 },
          callback: (value: any) => `${Number(value).toFixed(1)}%`,
        },
      },
    },
  };

  const cardDefs: Record<string, { title: string; icon: string; footnote?: string; chart: React.ReactNode }> = {
    'gm-percent': {
      title: 'Gross Margin % Trend',
      icon: '📊',
      chart: <Line data={gmPercentData} options={percentChartOptions} />,
    },
    'labor-rate': {
      title: 'Labor Rate Trend',
      icon: '⚙️',
      chart: <Line data={laborRateData} options={rateChartOptions} />,
    },
    'revenue': {
      title: 'Revenue Trend',
      icon: '💰',
      chart: <Line data={revenueData} options={currencyChartOptions} />,
    },
    'gm-by-complete': {
      title: 'GM% by % Complete',
      icon: '📊',
      chart: <Line data={gmByPercentCompleteData} options={gmByPercentCompleteOptions} />,
    },
    'budget-variance': {
      title: 'Budget Variance %',
      icon: '📉',
      footnote: 'Positive = under budget, Negative = over budget',
      chart: <Line data={costVarianceData} options={percentChartOptions} />,
    },
    'productivity': {
      title: 'Labor Productivity',
      icon: '⚡',
      footnote: 'Hours per $1000 revenue (lower is better)',
      chart: <Line data={productivityData} options={chartOptions} />,
    },
    'gm-vs-complete': {
      title: 'GM% × % Complete',
      icon: '📈',
      footnote: 'Higher = better margin vs completion',
      chart: <Line data={gmVsCompleteData} options={chartOptions} />,
    },
    'est-revenue-cost': {
      title: 'Est. Revenue vs Projected Cost',
      icon: '💵',
      footnote: 'Gap between lines = estimated gross profit',
      chart: <Line data={estRevenueVsCostData} options={estRevenueVsCostOptions} />,
    },
  };

  if (isLoading || isLoadingSnapshots) return <div className="loading">Loading...</div>;

  if (!project) return <div className="card">Project not found</div>;

  if (!hasData) {
    return (
      <div>
        <div style={{ marginBottom: '1rem' }}>
          <Link to={`/projects/${projectId}/financials`} style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.8rem' }}>
            &larr; Back to Financials
          </Link>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem' }}>Performance Trends</h2>
          <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{project.name}</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#475569' }}>No Performance Data Yet</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Historical snapshots are captured weekly on Thursdays. Charts will populate as data is collected over time.
          </p>
          <Link
            to={`/projects/${projectId}/financials`}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', textDecoration: 'none' }}
          >
            Return to Financials
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}/financials`} style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.8rem' }}>
          &larr; Back to Financials
        </Link>
        <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem' }}>Performance Trends</h2>
        <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{project.name}</div>
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: '#fef3c7',
          borderLeft: '3px solid #f59e0b',
          borderRadius: '4px',
          fontSize: '0.8rem',
          color: '#92400e'
        }}>
          📌 Note: Historical data snapshots are automatically captured every Thursday after payroll posts. You can also capture snapshots manually from the Financials page. Charts will populate as data is collected over time.
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {cardOrder.map(id => {
              const def = cardDefs[id];
              if (!def) return null;
              return (
                <SortableCard key={id} id={id} title={def.title} icon={def.icon} footnote={def.footnote}>
                  {def.chart}
                </SortableCard>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default ProjectPerformance;
