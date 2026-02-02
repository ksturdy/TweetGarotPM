import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { changeOrdersApi, ChangeOrder } from '../../services/changeOrders';

const ChangeOrderForm: React.FC = () => {
  const { projectId, id } = useParams<{ projectId: string; id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reason: '',
    amount: '',
    daysAdded: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch existing change order for edit mode
  const { data: changeOrder, isLoading: isLoadingCO } = useQuery({
    queryKey: ['changeOrder', id],
    queryFn: () => changeOrdersApi.getById(Number(id)).then(res => res.data),
    enabled: isEditMode,
  });

  // Populate form when editing
  useEffect(() => {
    if (changeOrder) {
      // Only allow editing draft change orders
      if (changeOrder.status !== 'draft') {
        navigate(`/projects/${projectId}/change-orders/${id}`);
        return;
      }
      setFormData({
        title: changeOrder.title || '',
        description: changeOrder.description || '',
        reason: changeOrder.reason || '',
        amount: changeOrder.amount?.toString() || '',
        daysAdded: changeOrder.days_added?.toString() || '',
      });
    }
  }, [changeOrder, id, projectId, navigate]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => changeOrdersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeOrders', projectId] });
      navigate(`/projects/${projectId}/change-orders`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => changeOrdersApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changeOrder', id] });
      queryClient.invalidateQueries({ queryKey: ['changeOrders', projectId] });
      navigate(`/projects/${projectId}/change-orders/${id}`);
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (formData.amount && isNaN(parseFloat(formData.amount))) {
      newErrors.amount = 'Amount must be a valid number';
    }

    if (formData.daysAdded && isNaN(parseInt(formData.daysAdded))) {
      newErrors.daysAdded = 'Days must be a valid integer';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const submitData = {
      projectId: Number(projectId),
      title: formData.title.trim(),
      description: formData.description.trim(),
      reason: formData.reason.trim() || undefined,
      amount: formData.amount ? parseFloat(formData.amount) : undefined,
      daysAdded: formData.daysAdded ? parseInt(formData.daysAdded) : undefined,
    };

    if (isEditMode) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error || updateMutation.error;

  if (isEditMode && isLoadingCO) {
    return (
      <div className="page-container">
        <div className="loading">Loading change order...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <Link to={`/projects/${projectId}/change-orders`} className="back-link">
          &larr; Back to Change Orders
        </Link>
        <h1>{isEditMode ? 'Edit Change Order' : 'New Change Order'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="form-container" style={{ maxWidth: '800px' }}>
        {/* Basic Information Section */}
        <div style={{
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
            Basic Information
          </h3>

          <div className="form-group">
            <label className="form-label" htmlFor="title">
              Title <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              className={`form-input ${errors.title ? 'input-error' : ''}`}
              value={formData.title}
              onChange={handleChange}
              placeholder="Enter change order title"
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">
              Description <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              id="description"
              name="description"
              className={`form-input ${errors.description ? 'input-error' : ''}`}
              value={formData.description}
              onChange={handleChange}
              rows={5}
              placeholder="Describe the change order in detail"
            />
            {errors.description && <span className="error-text">{errors.description}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reason">
              Reason for Change
            </label>
            <textarea
              id="reason"
              name="reason"
              className="form-input"
              value={formData.reason}
              onChange={handleChange}
              rows={3}
              placeholder="Why is this change needed?"
            />
          </div>
        </div>

        {/* Financial & Schedule Impact Section */}
        <div style={{
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
            Financial & Schedule Impact
          </h3>

          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="amount">
                Amount ($)
              </label>
              <input
                type="text"
                id="amount"
                name="amount"
                className={`form-input ${errors.amount ? 'input-error' : ''}`}
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
              />
              {errors.amount && <span className="error-text">{errors.amount}</span>}
              <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                Enter negative value for cost reduction
              </span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="daysAdded">
                Days Added
              </label>
              <input
                type="text"
                id="daysAdded"
                name="daysAdded"
                className={`form-input ${errors.daysAdded ? 'input-error' : ''}`}
                value={formData.daysAdded}
                onChange={handleChange}
                placeholder="0"
              />
              {errors.daysAdded && <span className="error-text">{errors.daysAdded}</span>}
              <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                Enter negative value for schedule reduction
              </span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {mutationError && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            {(mutationError as any)?.response?.data?.error || 'An error occurred. Please try again.'}
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/projects/${projectId}/change-orders`)}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPending}
          >
            {isPending
              ? (isEditMode ? 'Saving...' : 'Creating...')
              : (isEditMode ? 'Save Changes' : 'Create Change Order')
            }
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChangeOrderForm;
