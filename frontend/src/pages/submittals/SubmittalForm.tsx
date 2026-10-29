import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submittalsApi } from '../../services/submittals';
import '../../styles/SalesPipeline.css';

const SubmittalForm: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    projectId: Number(projectId),
    name: '',
    spec_section: '',
    description: '',
    subcontractor: '',
    due_date: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => submittalsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submittals', projectId] });
      navigate(`/projects/${projectId}/submittals`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      projectId: formData.projectId,
      name: formData.name,
      specSection: formData.spec_section,
      description: formData.description,
      subcontractor: formData.subcontractor || undefined,
      dueDate: formData.due_date || undefined,
    };
    createMutation.mutate(submitData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const errorMessage = createMutation.isError
    ? ((createMutation.error as any)?.response?.data?.errors?.[0]?.msg
        || (createMutation.error as any)?.response?.data?.error
        || 'Error creating submittal. Please try again.')
    : null;

  return (
    <div>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to={`/projects/${projectId}/submittals`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Submittals
            </Link>
            <h1>📎 New Submittal</h1>
            <div className="sales-subtitle">Create a new submittal</div>
          </div>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Submittal Name *</label>
            <input
              type="text"
              name="name"
              className="form-input"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., HVAC Equipment Submittal"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Spec Section *</label>
            <input
              type="text"
              name="spec_section"
              className="form-input"
              value={formData.spec_section}
              onChange={handleChange}
              placeholder="e.g., 23 05 13"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description *</label>
            <textarea
              name="description"
              className="form-input"
              rows={4}
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Vendor/Supplier</label>
            <input
              type="text"
              name="subcontractor"
              className="form-input"
              value={formData.subcontractor}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input
              type="date"
              name="due_date"
              className="form-input"
              value={formData.due_date}
              onChange={handleChange}
            />
          </div>

          {errorMessage && (
            <div className="error-message" style={{ marginBottom: '1rem' }}>
              {errorMessage}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(`/projects/${projectId}/submittals`)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Submittal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmittalForm;
