import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { projectSnapshotsApi } from '../../services/projectSnapshots';
import { format } from 'date-fns';
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

// Register Chart.js components
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

const ProjectPerformance: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(res => res.data),
  });

  const { data: snapshots = [], isLoading: isLoadingSnapshots } = useQuery({
    queryKey: ['projectSnapshots', projectId],
    queryFn: () => projectSnapshotsApi.getAll(Number(projectId!)).then(res => res.data),
    enabled: !!projectId,
  });

  // Transform snapshot data for charts
  const dates = snapshots.map(s => format(new Date(s.snapshot_date), 'MMM d'));
  const hasData = snapshots.length > 0;

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
        label: 'Target GM%',
        data: snapshots.map(s => (s.original_estimated_margin_pct || 0) * 100),
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

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: { size: 11 },
          padding: 10,
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
        ticks: {
          font: { size: 10 },
        },
      },
      x: {
        ticks: {
          font: { size: 10 },
        },
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
          callback: (value: any) => `${value}%`,
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
          callback: (value: any) => `$${(value / 1000).toFixed(0)}K`,
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
            Historical snapshots are captured weekly on Wednesdays. Charts will populate as data is collected over time.
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
          📌 Note: Historical data snapshots are automatically captured every Wednesday after payroll posts. You can also capture snapshots manually from the Financials page. Charts will populate as data is collected over time.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        {/* GM% Trend */}
        <div className="card" style={{ padding: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#475569' }}>
            📊 Gross Margin % Trend
          </h3>
          <div style={{ height: '180px' }}>
            <Line data={gmPercentData} options={percentChartOptions} />
          </div>
        </div>

        {/* Labor Rate Trend */}
        <div className="card" style={{ padding: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#475569' }}>
            ⚙️ Labor Rate Trend
          </h3>
          <div style={{ height: '180px' }}>
            <Line data={laborRateData} options={rateChartOptions} />
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="card" style={{ padding: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#475569' }}>
            💰 Revenue Trend
          </h3>
          <div style={{ height: '180px' }}>
            <Line data={revenueData} options={currencyChartOptions} />
          </div>
        </div>

        {/* GM% × % Complete */}
        <div className="card" style={{ padding: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#475569' }}>
            📈 GM% × % Complete
          </h3>
          <div style={{ height: '180px' }}>
            <Line data={gmVsCompleteData} options={chartOptions} />
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.35rem' }}>
            Higher = better margin vs completion
          </div>
        </div>

        {/* Budget Variance */}
        <div className="card" style={{ padding: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#475569' }}>
            📉 Budget Variance %
          </h3>
          <div style={{ height: '180px' }}>
            <Line data={costVarianceData} options={percentChartOptions} />
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.35rem' }}>
            Positive = under budget, Negative = over budget
          </div>
        </div>

        {/* Productivity Index */}
        <div className="card" style={{ padding: '0.75rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#475569' }}>
            ⚡ Labor Productivity
          </h3>
          <div style={{ height: '180px' }}>
            <Line data={productivityData} options={chartOptions} />
          </div>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.35rem' }}>
            Hours per $1000 revenue (lower is better)
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectPerformance;
