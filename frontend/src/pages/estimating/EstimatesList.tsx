import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { estimatesApi, Estimate } from '../../services/estimates';
import EstimateProposalPreviewModal from '../../components/estimates/EstimateProposalPreviewModal';
import './EstimatesList.css';

const EstimatesList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('created_at');
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

  const handleViewProposal = async (estimateId: number) => {
    try {
      const response = await estimatesApi.getById(estimateId);
      setPreviewEstimate(response.data);
      setIsPreviewOpen(true);
    } catch (error) {
      console.error('Failed to load estimate:', error);
      alert('Failed to load estimate preview');
    }
  };

  const handleStatusChange = (e: React.MouseEvent, estimateId: number, newStatus: string) => {
    e.stopPropagation();
    updateStatusMutation.mutate({ id: estimateId, status: newStatus });
  };

  // Get status color and styling
  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      'in progress': '#3b82f6',
      'submitted': '#f59e0b',
      'awarded': '#10b981',
      'lost': '#ef4444',
      'cancelled': '#6b7280',
    };
    return colors[status?.toLowerCase()] || '#3b82f6';
  };

  // Get estimator initials
  const getEstimatorInitials = (name?: string): string => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Get estimator color
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

  // Get project gradient based on name (matching Sales Pipeline style)
  const getProjectGradient = (name?: string): string => {
    const gradients = [
      'linear-gradient(135deg, #3b82f6, #8b5cf6)',  // blue to purple
      'linear-gradient(135deg, #10b981, #06b6d4)',  // emerald to cyan
      'linear-gradient(135deg, #f59e0b, #f43f5e)',  // amber to rose
      'linear-gradient(135deg, #8b5cf6, #ec4899)',  // purple to pink
      'linear-gradient(135deg, #06b6d4, #3b82f6)',  // cyan to blue
    ];
    if (!name) return gradients[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  // Get project icon based on name
  const getProjectIcon = (name?: string): string => {
    const icons = ['🏢', '🏗️', '🏭', '🏥', '🎓'];
    if (!name) return icons[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return icons[Math.abs(hash) % icons.length];
  };

  // Sort estimates
  const sortedEstimates = [...estimates].sort((a: any, b: any) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
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
      case 'created_at':
        aValue = new Date(a.created_at || 0).getTime();
        bValue = new Date(b.created_at || 0).getTime();
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

  // Handle sort column click
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Calculate stats
  const totalValue = estimates.reduce((sum: number, e: any) => sum + Number(e.total_cost || 0), 0);
  const awardedValue = estimates.filter((e: any) => e.status === 'awarded').reduce((sum: number, e: any) => sum + Number(e.total_cost || 0), 0);
  const inProgressCount = estimates.filter((e: any) => e.status === 'in progress').length;
  const submittedCount = estimates.filter((e: any) => e.status === 'submitted').length;

  if (isLoading) {
    return (
      <div className="estimates-page">
        <div className="estimates-loading">
          <div>Loading estimates...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="estimates-page">
      {/* Back Link */}
      <Link to="/" className="back-link">&larr; Back to Dashboard</Link>

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1>Estimates</h1>
          <p>Manage estimates, budgets and proposals</p>
        </div>
        <div className="page-header-actions">
          <Link to="/estimating/budgets" className="btn btn-secondary">
            New Budget
          </Link>
          <Link to="/estimating/estimates/new" className="btn btn-primary">
            + New Estimate
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="estimates-kpi-grid">
        <div className="estimates-kpi-card">
          <div className="estimates-kpi-icon blue">📋</div>
          <div className="estimates-kpi-content">
            <div className="estimates-kpi-value">{estimates.length}</div>
            <div className="estimates-kpi-label">Total Estimates</div>
          </div>
        </div>
        <div className="estimates-kpi-card">
          <div className="estimates-kpi-icon orange">💰</div>
          <div className="estimates-kpi-content">
            <div className="estimates-kpi-value">${(totalValue / 1000000).toFixed(1)}M</div>
            <div className="estimates-kpi-label">Total Value</div>
          </div>
        </div>
        <div className="estimates-kpi-card">
          <div className="estimates-kpi-icon green">🏆</div>
          <div className="estimates-kpi-content">
            <div className="estimates-kpi-value">${(awardedValue / 1000000).toFixed(1)}M</div>
            <div className="estimates-kpi-label">Awarded</div>
          </div>
        </div>
        <div className="estimates-kpi-card">
          <div className="estimates-kpi-icon purple">⏳</div>
          <div className="estimates-kpi-content">
            <div className="estimates-kpi-value">{inProgressCount + submittedCount}</div>
            <div className="estimates-kpi-label">Active</div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="estimates-table-section">
        <div className="estimates-table-header">
          <div className="estimates-table-title">All Estimates</div>
          <div className="estimates-table-controls">
            <div className="estimates-search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search estimates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="estimates-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="in progress">In Progress</option>
              <option value="submitted">Submitted</option>
              <option value="awarded">Awarded</option>
              <option value="lost">Lost</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <table className="estimates-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('estimate_number')} style={{ width: '140px' }}>
                # <span className="sort-icon">{sortColumn === 'estimate_number' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th onClick={() => handleSort('project_name')}>
                Project Name <span className="sort-icon">{sortColumn === 'project_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th onClick={() => handleSort('customer_name')}>
                Customer <span className="sort-icon">{sortColumn === 'customer_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th onClick={() => handleSort('total_cost')} style={{ textAlign: 'right' }}>
                Amount <span className="sort-icon">{sortColumn === 'total_cost' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th onClick={() => handleSort('status')}>
                Status <span className="sort-icon">{sortColumn === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th onClick={() => handleSort('created_at')}>
                Created <span className="sort-icon">{sortColumn === 'created_at' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th onClick={() => handleSort('estimator_name')}>
                Estimator <span className="sort-icon">{sortColumn === 'estimator_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedEstimates.length > 0 ? (
              sortedEstimates.map((estimate: any) => (
                <tr
                  key={estimate.id}
                  onClick={() => navigate(`/estimating/estimates/${estimate.id}`)}
                >
                  <td>
                    <span className="estimate-number">{estimate.estimate_number}</span>
                  </td>
                  <td>
                    <div className="estimate-project-cell">
                      <div
                        className="estimate-project-icon"
                        style={{ background: getProjectGradient(estimate.project_name) }}
                      >
                        {getProjectIcon(estimate.project_name)}
                      </div>
                      <span className="estimate-project-name">{estimate.project_name || 'Untitled'}</span>
                    </div>
                  </td>
                  <td>{estimate.customer_name || '-'}</td>
                  <td className="estimate-amount">
                    ${Number(estimate.total_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      className="estimate-status-select"
                      value={estimate.status || 'in progress'}
                      onChange={(e) => handleStatusChange(e as any, estimate.id, e.target.value)}
                      style={{
                        background: `${getStatusColor(estimate.status)}15`,
                        borderColor: getStatusColor(estimate.status),
                        color: getStatusColor(estimate.status),
                      }}
                    >
                      <option value="in progress">In Progress</option>
                      <option value="submitted">Submitted</option>
                      <option value="awarded">Awarded</option>
                      <option value="lost">Lost</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>{estimate.created_at ? new Date(estimate.created_at).toLocaleDateString() : '-'}</td>
                  <td>
                    {estimate.estimator_name ? (
                      <div className="estimator-cell">
                        <div
                          className="estimator-avatar"
                          style={{ background: getEstimatorColor(estimate.estimator_name) }}
                        >
                          {getEstimatorInitials(estimate.estimator_name)}
                        </div>
                        <span className="estimator-name">{estimate.estimator_name}</span>
                      </div>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>Unassigned</span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="estimate-actions">
                      <button
                        onClick={() => handleViewProposal(estimate.id)}
                        className="btn btn-secondary btn-sm"
                      >
                        View
                      </button>
                      <Link
                        to={`/estimating/estimates/${estimate.id}`}
                        className="btn btn-primary btn-sm"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  <div className="estimates-empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>No estimates found</h3>
                    <p>{searchQuery || statusFilter ? 'Try adjusting your filters' : 'Get started by creating your first estimate'}</p>
                    <Link to="/estimating/estimates/new" className="btn btn-primary">
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
