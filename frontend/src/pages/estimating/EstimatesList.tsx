import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { estimatesApi, Estimate } from '../../services/estimates';
import EstimateProposalPreviewModal from '../../components/estimates/EstimateProposalPreviewModal';
import '../../styles/SalesPipeline.css';

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
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading estimates...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/estimating" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Estimating
            </Link>
            <h1>📊 Estimates</h1>
            <div className="sales-subtitle">Project Estimates & Proposals</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <Link to="/estimating/estimates/new" className="sales-btn sales-btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Estimate
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', width: '36px', height: '36px', fontSize: '1rem' }}>📋</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>{estimates.length}</div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>Total Estimates</div>
          </div>
        </div>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)', width: '36px', height: '36px', fontSize: '1rem' }}>💰</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>${(totalValue / 1000000).toFixed(1)}M</div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>Total Value</div>
          </div>
        </div>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', width: '36px', height: '36px', fontSize: '1rem' }}>🏆</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>${(awardedValue / 1000000).toFixed(1)}M</div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>Awarded</div>
          </div>
        </div>
        <div className="sales-kpi-card" style={{ padding: '0.75rem' }}>
          <div className="sales-kpi-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', width: '36px', height: '36px', fontSize: '1rem' }}>⏳</div>
          <div className="sales-kpi-content">
            <div className="sales-kpi-value" style={{ fontSize: '1.25rem' }}>{inProgressCount + submittedCount}</div>
            <div className="sales-kpi-label" style={{ fontSize: '0.7rem' }}>Active</div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">All Estimates</div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
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
              className="sales-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}
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
        <table className="sales-table">
          <thead>
            <tr>
              <th className="sales-sortable" onClick={() => handleSort('estimate_number')} style={{ width: '100px' }}>
                # <span className="sales-sort-icon">{sortColumn === 'estimate_number' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('project_name')}>
                Project Name <span className="sales-sort-icon">{sortColumn === 'project_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('customer_name')}>
                Customer <span className="sales-sort-icon">{sortColumn === 'customer_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('total_cost')} style={{ textAlign: 'right' }}>
                Amount <span className="sales-sort-icon">{sortColumn === 'total_cost' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('status')}>
                Status <span className="sales-sort-icon">{sortColumn === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('created_at')}>
                Created <span className="sales-sort-icon">{sortColumn === 'created_at' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('estimator_name')}>
                Estimator <span className="sales-sort-icon">{sortColumn === 'estimator_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
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
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <span style={{ color: '#3b82f6', fontWeight: 500 }}>{estimate.estimate_number}</span>
                  </td>
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                        📊
                      </div>
                      <div className="sales-project-info">
                        <h4>{estimate.project_name || 'Untitled'}</h4>
                      </div>
                    </div>
                  </td>
                  <td>{estimate.customer_name || '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    ${Number(estimate.total_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      value={estimate.status || 'in progress'}
                      onChange={(e) => handleStatusChange(e as any, estimate.id, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: `1px solid ${getStatusColor(estimate.status)}`,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        background: `${getStatusColor(estimate.status)}15`,
                        color: getStatusColor(estimate.status),
                        fontWeight: 500,
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
                      <div className="sales-salesperson-cell">
                        <div
                          className="sales-salesperson-avatar"
                          style={{ background: getEstimatorColor(estimate.estimator_name) }}
                        >
                          {getEstimatorInitials(estimate.estimator_name)}
                        </div>
                        {estimate.estimator_name}
                      </div>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>Unassigned</span>
                    )}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleViewProposal(estimate.id)}
                        className="sales-btn sales-btn-secondary"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                      >
                        View
                      </button>
                      <Link
                        to={`/estimating/estimates/${estimate.id}`}
                        className="sales-btn sales-btn-primary"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem', textDecoration: 'none' }}
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                  <div>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No estimates found</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '1.5rem' }}>
                      {searchQuery || statusFilter ? 'Try adjusting your filters' : 'Get started by creating your first estimate'}
                    </p>
                    <Link to="/estimating/estimates/new" className="sales-btn sales-btn-primary">
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
