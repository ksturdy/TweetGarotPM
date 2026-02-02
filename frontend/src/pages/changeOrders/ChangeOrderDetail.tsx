import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { changeOrdersApi, ChangeOrder } from '../../services/changeOrders';
import { projectsApi } from '../../services/projects';
import { useAuth } from '../../context/AuthContext';

const ChangeOrderDetail: React.FC = () => {
  const { projectId, id } = useParams<{ projectId: string; id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reason: '',
    amount: '',
    daysAdded: '',
  });

  // Check if user can approve/reject
  const canApprove = user?.role === 'admin' || user?.role === 'manager';

  // Fetch project
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(res => res.data),
  });

  // Fetch change order
  const { data: changeOrder, isLoading, error } = useQuery({
    queryKey: ['changeOrder', id],
    queryFn: () => changeOrdersApi.getById(Number(id)).then(res => res.data),
  });

  // Populate form when data loads
  useEffect(() => {
    if (changeOrder) {
      setFormData({
        title: changeOrder.title || '',
        description: changeOrder.description || '',
        reason: changeOrder.reason || '',
        amount: changeOrder.amount?.toString() || '',
        daysAdded: changeOrder.days_added?.toString() || '',
      });
    }
  }, [changeOrder]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => changeOrdersApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeOrder', id] });
      queryClient.invalidateQueries({ queryKey: ['changeOrders', projectId] });
      setIsEditing(false);
    },
  });

  // Submit for approval mutation
  const submitMutation = useMutation({
    mutationFn: () => changeOrdersApi.submit(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeOrder', id] });
      queryClient.invalidateQueries({ queryKey: ['changeOrders', projectId] });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: () => changeOrdersApi.approve(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeOrder', id] });
      queryClient.invalidateQueries({ queryKey: ['changeOrders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['changeOrderTotals', projectId] });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => changeOrdersApi.reject(Number(id), reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeOrder', id] });
      queryClient.invalidateQueries({ queryKey: ['changeOrders', projectId] });
      setShowRejectModal(false);
      setRejectionReason('');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      reason: formData.reason.trim() || undefined,
      amount: formData.amount ? parseFloat(formData.amount) : undefined,
      daysAdded: formData.daysAdded ? parseInt(formData.daysAdded) : undefined,
    };
    updateMutation.mutate(submitData);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (changeOrder) {
      setFormData({
        title: changeOrder.title || '',
        description: changeOrder.description || '',
        reason: changeOrder.reason || '',
        amount: changeOrder.amount?.toString() || '',
        daysAdded: changeOrder.days_added?.toString() || '',
      });
    }
  };

  const handleSubmitForApproval = () => {
    if (window.confirm('Submit this change order for approval?')) {
      submitMutation.mutate();
    }
  };

  const handleApprove = () => {
    const amountText = changeOrder?.amount
      ? formatCurrency(changeOrder.amount)
      : '$0.00';
    if (window.confirm(`Approve this change order for ${amountText}?`)) {
      approveMutation.mutate();
    }
  };

  const handleReject = () => {
    if (rejectionReason.trim().length < 10) {
      return;
    }
    rejectMutation.mutate(rejectionReason.trim());
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      draft: 'badge-info',
      pending: 'badge-warning',
      approved: 'badge-success',
      rejected: 'badge-danger',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (error || !changeOrder) {
    return (
      <div className="card">
        Change Order not found. <Link to={`/projects/${projectId}/change-orders`}>Go back</Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back Link */}
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}/change-orders`}>&larr; Back to Change Orders</Link>
      </div>

      {/* Header */}
      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>CO-{changeOrder.number}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!isEditing && changeOrder.status === 'draft' && (
            <>
              <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                Edit
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitForApproval}
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </>
          )}

          {!isEditing && changeOrder.status === 'pending' && canApprove && (
            <>
              <button
                className="btn btn-success"
                onClick={handleApprove}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve'}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => setShowRejectModal(true)}
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        {isEditing ? (
          /* Edit Form */
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                type="text"
                name="title"
                className="form-input"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea
                name="description"
                className="form-input"
                rows={5}
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reason for Change</label>
              <textarea
                name="reason"
                className="form-input"
                rows={3}
                value={formData.reason}
                onChange={handleChange}
              />
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Amount ($)</label>
                <input
                  type="text"
                  name="amount"
                  className="form-input"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Days Added</label>
                <input
                  type="text"
                  name="daysAdded"
                  className="form-input"
                  value={formData.daysAdded}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {updateMutation.isError && (
              <div className="error-message" style={{ marginTop: '1rem' }}>
                Error updating change order. Please try again.
              </div>
            )}
          </form>
        ) : (
          /* View Mode */
          <div>
            {/* Status Badge and Title */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <span className={getStatusBadge(changeOrder.status)}>
                  {changeOrder.status.charAt(0).toUpperCase() + changeOrder.status.slice(1)}
                </span>
              </div>
              <h2 style={{ margin: '0 0 1rem 0' }}>{changeOrder.title}</h2>
            </div>

            {/* Financial Impact */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1rem',
              marginBottom: '1.5rem',
              padding: '1rem',
              background: '#f8fafc',
              borderRadius: '8px'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Amount
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: (changeOrder.amount || 0) < 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {formatCurrency(changeOrder.amount || 0)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Schedule Impact
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {(changeOrder.days_added || 0) > 0 ? '+' : ''}{changeOrder.days_added || 0} days
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Description
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{changeOrder.description}</div>
            </div>

            {/* Reason */}
            {changeOrder.reason && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Reason for Change
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{changeOrder.reason}</div>
              </div>
            )}

            {/* Rejection Reason */}
            {changeOrder.status === 'rejected' && changeOrder.rejection_reason && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#991b1b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Rejection Reason
                </div>
                <div style={{ whiteSpace: 'pre-wrap', color: '#7f1d1d' }}>
                  {changeOrder.rejection_reason}
                </div>
              </div>
            )}

            {/* Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Created By</div>
                <div>{changeOrder.created_by_name || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Created</div>
                <div>{format(new Date(changeOrder.created_at), 'MMM d, yyyy')}</div>
              </div>
              {changeOrder.approved_by_name && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Approved By</div>
                  <div>{changeOrder.approved_by_name}</div>
                </div>
              )}
              {changeOrder.approved_at && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Approved</div>
                  <div>{format(new Date(changeOrder.approved_at), 'MMM d, yyyy')}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Reject Change Order</h3>
            <p style={{ color: 'var(--secondary)', marginBottom: '1rem' }}>
              Please provide a reason for rejection:
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="form-input"
              placeholder="Enter rejection reason (minimum 10 characters)..."
              style={{ width: '100%', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                disabled={rejectionReason.trim().length < 10 || rejectMutation.isPending}
                onClick={handleReject}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject Change Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChangeOrderDetail;
