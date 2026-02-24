import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { estimatesApi, Estimate } from '../../services/estimates';
import EstimateProposalPreviewModal from '../../components/estimates/EstimateProposalPreviewModal';
import './EstimatesList.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const EstimatesList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('activity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [previewEstimate, setPreviewEstimate] = useState<Estimate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ['estimates', statusFilter, searchQuery],
    queryFn: () => estimatesApi.getAll({ status: statusFilter, search: searchQuery }).then((res) => res.data),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      estimatesApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
    },
    onError: (error: any) => {
      console.error('Failed to update status:', error);
      alert(`Failed to update status: ${error.response?.data?.error || error.message || 'Unknown error'}`);
    },
  });

  const handleViewProposal = async (e: React.MouseEvent, estimateId: number) => {
    e.stopPropagation();
    try {
      const response = await estimatesApi.getById(estimateId);
      setPreviewEstimate(response.data);
      setIsPreviewOpen(true);
    } catch (error) {
      console.error('Failed to load estimate:', error);
      alert('Failed to load estimate preview');
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  // Status helpers
  const getStatusBadgeClass = (status: string): string => {
    const statusMap: Record<string, string> = {
      'in progress': 'in-progress',
      'submitted': 'submitted',
      'awarded': 'awarded',
      'lost': 'lost',
      'cancelled': 'cancelled',
    };
    return statusMap[status?.toLowerCase()] || 'in-progress';
  };

  const formatStatusText = (status: string): string => {
    if (!status || status.toLowerCase() === 'in progress') return 'Bidding';
    return status.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Estimator helpers
  const getEstimatorInitials = (name?: string): string => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getEstimatorColor = (name?: string): string => {
    if (!name) return '#6b7280';
    const colors = [
      '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Project icon helpers
  const getProjectGradient = (name?: string): string => {
    const gradients = [
      'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      'linear-gradient(135deg, #10b981, #06b6d4)',
      'linear-gradient(135deg, #f59e0b, #f43f5e)',
      'linear-gradient(135deg, #8b5cf6, #ec4899)',
      'linear-gradient(135deg, #06b6d4, #3b82f6)',
    ];
    if (!name) return gradients[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  const getBuildingTypeIcon = (type?: string): string => {
    const icons: Record<string, string> = {
      'Healthcare': '🏥', 'Education': '🏫', 'Commercial': '🏢',
      'Industrial': '🏭', 'Retail': '🏬', 'Government': '🏛️',
      'Hospitality': '🏨', 'Data Center': '💾', 'Residential': '🏠',
    };
    return icons[type || ''] || '🏗️';
  };

  // KPI calculations
  const totalValue = estimates.reduce((sum: number, e: any) => sum + Number(e.total_cost || 0), 0);
  const awardedValue = estimates.filter((e: any) => e.status === 'awarded').reduce((sum: number, e: any) => sum + Number(e.total_cost || 0), 0);
  const inProgressCount = estimates.filter((e: any) => e.status === 'in progress').length;
  const submittedCount = estimates.filter((e: any) => e.status === 'submitted').length;
  const awardedCount = estimates.filter((e: any) => e.status === 'awarded').length;
  const winRate = estimates.length > 0 ? (awardedCount / estimates.length) * 100 : 0;

  // Chart: Monthly estimate value trend (last 7 months)
  const trendChartData = useMemo(() => {
    const now = new Date();
    const months: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
      const monthEstimates = estimates.filter((e: any) => {
        const created = new Date(e.created_at);
        return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
      });
      const total = monthEstimates.reduce((sum: number, e: any) => sum + Number(e.total_cost || 0), 0);
      months.push({ label: monthLabel, value: total / 1000000 });
    }
    return {
      labels: months.map(m => m.label),
      datasets: [{
        label: 'Estimate Value',
        data: months.map(m => m.value),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      }],
    };
  }, [estimates]);

  // Chart: Status funnel
  const statusFunnelData = useMemo(() => {
    const statuses = [
      { name: 'Bidding', key: 'in progress', color: '#3b82f6' },
      { name: 'Submitted', key: 'submitted', color: '#f59e0b' },
      { name: 'Awarded', key: 'awarded', color: '#10b981' },
      { name: 'Lost', key: 'lost', color: '#ef4444' },
    ];
    return statuses.map(s => {
      const filtered = estimates.filter((e: any) => e.status === s.key);
      return {
        ...s,
        count: filtered.length,
        value: filtered.reduce((sum: number, e: any) => sum + Number(e.total_cost || 0), 0),
      };
    });
  }, [estimates]);

  const maxFunnelValue = Math.max(...statusFunnelData.map(s => s.value), 1);

  // Chart: By building type
  const buildingTypeData = useMemo(() => {
    const types: Record<string, { count: number; value: number }> = {};
    estimates.forEach((e: any) => {
      const bt = e.building_type || 'Other';
      if (!types[bt]) types[bt] = { count: 0, value: 0 };
      types[bt].count++;
      types[bt].value += Number(e.total_cost || 0);
    });
    const sorted = Object.entries(types).sort((a, b) => b[1].value - a[1].value);
    return sorted;
  }, [estimates]);

  const getBuildingTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      'Healthcare': '#10b981', 'Education': '#3b82f6', 'Commercial': '#8b5cf6',
      'Industrial': '#f59e0b', 'Retail': '#06b6d4', 'Government': '#ec4899',
    };
    return colors[type] || '#6b7280';
  };

  const buildingTypeBarData = {
    labels: buildingTypeData.map(([name]) => name),
    datasets: [{
      label: 'Estimate Value',
      data: buildingTypeData.map(([, data]) => data.value),
      backgroundColor: buildingTypeData.map(([name]) => getBuildingTypeColor(name)),
      borderRadius: 4,
      barThickness: 28,
    }],
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.label}: ${formatCurrency(context.parsed.y)}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: { callback: (value: any) => formatCurrency(value) },
      },
      x: { grid: { display: false } },
    },
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, datalabels: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
      x: { grid: { display: false } },
    },
  };

  // Sort estimates
  const sortedEstimates = [...estimates].sort((a: any, b: any) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'activity':
        aValue = new Date(a.updated_at || a.created_at || 0).getTime();
        bValue = new Date(b.updated_at || b.created_at || 0).getTime();
        break;
      case 'estimate_number':
        aValue = a.estimate_number || '';
        bValue = b.estimate_number || '';
        break;
      case 'project_name':
        aValue = (a.project_name || '').toLowerCase();
        bValue = (b.project_name || '').toLowerCase();
        break;
      case 'customer_name':
        aValue = (a.customer_name || '').toLowerCase();
        bValue = (b.customer_name || '').toLowerCase();
        break;
      case 'total_cost':
        aValue = Number(a.total_cost || 0);
        bValue = Number(b.total_cost || 0);
        break;
      case 'status':
        aValue = (a.status || '').toLowerCase();
        bValue = (b.status || '').toLowerCase();
        break;
      case 'estimator_name':
        aValue = (a.estimator_name || '').toLowerCase();
        bValue = (b.estimator_name || '').toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="est-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading estimates...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="est-container">
      {/* Compact Header */}
      <div className="est-page-header">
        <div className="est-page-title">
          <h1>Estimates</h1>
        </div>
        <div className="est-header-actions">
          <Link to="/estimating/budgets" className="est-btn est-btn-secondary">
            Budgets
          </Link>
          <button className="est-btn est-btn-secondary">
            Export
          </button>
          <Link to="/estimating/estimates/new" className="est-btn est-btn-primary">
            + New Estimate
          </Link>
        </div>
      </div>

      {/* Compact KPI Strip */}
      <div className="est-kpi-grid">
        <div className="est-kpi-card blue">
          <div className="est-kpi-label">Total Estimates</div>
          <div className="est-kpi-value">{estimates.length}</div>
        </div>
        <div className="est-kpi-card amber">
          <div className="est-kpi-label">Total Value</div>
          <div className="est-kpi-value">{formatCurrency(totalValue)}</div>
        </div>
        <div className="est-kpi-card green">
          <div className="est-kpi-label">Awarded</div>
          <div className="est-kpi-value">{formatCurrency(awardedValue)}</div>
        </div>
        <div className="est-kpi-card purple">
          <div className="est-kpi-label">Win Rate</div>
          <div className="est-kpi-value">{winRate.toFixed(0)}%</div>
        </div>
      </div>

      {/* Charts */}
      <div className="est-charts-grid">
        <div className="est-chart-card">
          <div className="est-chart-header">
            <div>
              <div className="est-chart-title">Estimate Trend</div>
              <div className="est-chart-subtitle">Monthly estimate value</div>
            </div>
          </div>
          <div className="est-chart-container">
            <Line data={trendChartData} options={lineChartOptions} />
          </div>
        </div>
        <div className="est-chart-card">
          <div className="est-chart-header">
            <div>
              <div className="est-chart-title">Status Breakdown</div>
              <div className="est-chart-subtitle">Estimates by status</div>
            </div>
          </div>
          <div className="est-chart-container">
            <div className="est-funnel-container">
              {statusFunnelData.map(stage => {
                const widthPercent = maxFunnelValue > 0 ? (stage.value / maxFunnelValue) * 100 : 0;
                return (
                  <div key={stage.key} className="est-funnel-stage">
                    <div className="est-funnel-label">{stage.name}</div>
                    <div className="est-funnel-bar-container">
                      <div
                        className="est-funnel-bar"
                        style={{ width: `${Math.max(widthPercent, stage.count > 0 ? 8 : 0)}%`, background: stage.color }}
                      >
                        {stage.count}
                      </div>
                    </div>
                    <div className="est-funnel-value" style={{ color: stage.color }}>
                      {formatCurrency(stage.value)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="est-chart-card">
          <div className="est-chart-header">
            <div>
              <div className="est-chart-title">By Type</div>
              <div className="est-chart-subtitle">Building type breakdown</div>
            </div>
          </div>
          <div className="est-chart-container">
            <Bar data={buildingTypeBarData} options={barChartOptions} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="est-table-section">
        <div className="est-table-header">
          <div className="est-table-title">All Estimates</div>
          <div className="est-table-controls">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="est-filter-select"
            >
              <option value="">All Statuses</option>
              <option value="in progress">Bidding</option>
              <option value="submitted">Submitted</option>
              <option value="awarded">Awarded</option>
              <option value="lost">Lost</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <div className="est-search-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <table className="est-table">
          <thead>
            <tr>
              <th className="est-sortable" onClick={() => handleSort('activity')}>
                Activity <span className="est-sort-icon">{sortColumn === 'activity' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="est-sortable" onClick={() => handleSort('estimate_number')}>
                Est # <span className="est-sort-icon">{sortColumn === 'estimate_number' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="est-sortable" onClick={() => handleSort('project_name')}>
                Project <span className="est-sort-icon">{sortColumn === 'project_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="est-sortable" onClick={() => handleSort('customer_name')}>
                Customer <span className="est-sort-icon">{sortColumn === 'customer_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="est-sortable" onClick={() => handleSort('total_cost')}>
                Value <span className="est-sort-icon">{sortColumn === 'total_cost' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="est-sortable" onClick={() => handleSort('status')}>
                Status <span className="est-sort-icon">{sortColumn === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="est-sortable" onClick={() => handleSort('estimator_name')}>
                Estimator <span className="est-sort-icon">{sortColumn === 'estimator_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEstimates.length > 0 ? (
              sortedEstimates.map((estimate: any) => (
                <tr
                  key={estimate.id}
                  onClick={() => navigate(`/estimating/estimates/${estimate.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="est-date-cell">
                    {estimate.updated_at
                      ? new Date(estimate.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '-'}
                  </td>
                  <td>
                    <span className="est-number">{estimate.estimate_number}</span>
                  </td>
                  <td>
                    <div className="est-project-cell">
                      <div
                        className="est-project-icon"
                        style={{ background: getProjectGradient(estimate.project_name) }}
                      >
                        {getBuildingTypeIcon(estimate.building_type)}
                      </div>
                      <span className="est-project-name">{estimate.project_name || 'Untitled'}</span>
                    </div>
                  </td>
                  <td>{estimate.customer_owner || estimate.customer_name || estimate.customer_facility || '-'}</td>
                  <td className="est-value-cell">
                    {formatCurrency(Number(estimate.total_cost || 0))}
                  </td>
                  <td>
                    <span className={`est-stage-badge ${getStatusBadgeClass(estimate.status)}`}>
                      <span className="est-stage-dot"></span>
                      {formatStatusText(estimate.status)}
                    </span>
                  </td>
                  <td>
                    {estimate.estimator_name ? (
                      <div className="est-person-cell">
                        <div
                          className="est-person-avatar"
                          style={{ background: getEstimatorColor(estimate.estimator_name) }}
                        >
                          {getEstimatorInitials(estimate.estimator_name)}
                        </div>
                        {estimate.estimator_name}
                      </div>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '12px' }}>Unassigned</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <div className="est-empty-state">
                    <h3>No estimates found</h3>
                    <p>{searchQuery || statusFilter ? 'Try adjusting your filters' : 'Get started by creating your first estimate'}</p>
                    <Link to="/estimating/estimates/new" className="est-btn est-btn-primary">
                      Create Estimate
                    </Link>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      {previewEstimate && (
        <EstimateProposalPreviewModal
          estimate={previewEstimate}
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewEstimate(null);
          }}
        />
      )}
    </div>
  );
};

export default EstimatesList;
