import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { estimatesApi, Estimate } from '../../services/estimates';
import EstimateProposalPreviewModal from '../../components/estimates/EstimateProposalPreviewModal';
import './EstimatesList.css';

const EstimatesList: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewEstimate, setPreviewEstimate] = useState<Estimate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { data: estimates, isLoading } = useQuery({
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

  const handleStatusChange = (estimateId: number, newStatus: string) => {
    updateStatusMutation.mutate({ id: estimateId, status: newStatus });
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      'in progress': 'badge-info',
      'submitted': 'badge-warning',
      'awarded': 'badge-success',
      'lost': 'badge-danger',
      'cancelled': 'badge-secondary',
    };
    return `badge ${classes[status.toLowerCase()] || 'badge-info'}`;
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/estimating">&larr; Back to Estimating</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Estimates</h1>
        <Link to="/estimating/estimates/new" className="btn btn-primary">
          New Estimate
        </Link>
      </div>

      <div className="estimates-filters card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>Status</label>
            <select
              className="form-input"
              style={{ width: 'auto' }}
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
          <div>
            <label className="form-label" style={{ marginBottom: '0.25rem' }}>Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search estimates..."
              style={{ width: '300px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p>Loading estimates...</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Project Name</th>
                <th>Customer</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Estimator</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {estimates?.map((estimate: any) => (
                <tr key={estimate.id}>
                  <td><Link to={`/estimating/estimates/${estimate.id}`}>{estimate.estimate_number}</Link></td>
                  <td>{estimate.project_name}</td>
                  <td>{estimate.customer_name || 'N/A'}</td>
                  <td>${Number(estimate.total_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  <td>
                    <select
                      value={estimate.status}
                      onChange={(e) => handleStatusChange(estimate.id, e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                    >
                      <option value="in progress">In Progress</option>
                      <option value="submitted">Submitted</option>
                      <option value="awarded">Awarded</option>
                      <option value="lost">Lost</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>{new Date(estimate.created_at).toLocaleDateString()}</td>
                  <td>{estimate.estimator_name || 'N/A'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        onClick={() => handleViewProposal(estimate.id)}
                      >
                        View
                      </button>
                      <Link
                        to={`/estimating/estimates/${estimate.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {estimates?.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                  <div className="empty-state">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                    <p style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>
                      No estimates yet
                    </p>
                    <p style={{ color: 'var(--secondary)', marginBottom: '1.5rem' }}>
                      Get started by creating your first estimate
                    </p>
                    <Link to="/estimating/estimates/new" className="btn btn-primary">
                      Create Estimate
                    </Link>
                  </div>
                </td>
              </tr>
              )}
            </tbody>
          </table>
        )}
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
