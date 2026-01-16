import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { submittalsApi } from '../../services/submittals';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';

const SubmittalDetail: React.FC = () => {
  const { projectId, id } = useParams<{ projectId: string; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: submittal, isLoading } = useQuery({
    queryKey: ['submittal', id],
    queryFn: () => submittalsApi.getById(Number(id)).then((res) => res.data),
  });

  const [formData, setFormData] = useState({
    spec_section: '',
    description: '',
    subcontractor: '',
    due_date: '',
    status: 'pending',
  });

  React.useEffect(() => {
    if (submittal) {
      setFormData({
        spec_section: submittal.spec_section,
        description: submittal.description,
        subcontractor: submittal.subcontractor || '',
        due_date: submittal.due_date || '',
        status: submittal.status,
      });
    }
  }, [submittal]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => submittalsApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submittal', id] });
      queryClient.invalidateQueries({ queryKey: ['submittals', projectId] });
      setIsEditing(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      specSection: formData.spec_section,
      description: formData.description,
      subcontractor: formData.subcontractor || undefined,
      dueDate: formData.due_date || undefined,
      status: formData.status,
    };
    updateMutation.mutate(submitData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!submittal) {
    return <div className="card">Submittal not found</div>;
  }

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      pending: 'badge-warning',
      under_review: 'badge-info',
      approved: 'badge-success',
      approved_as_noted: 'badge-success',
      revise_resubmit: 'badge-warning',
      rejected: 'badge-danger',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}/submittals`}>&larr; Back to Submittals</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Submittal #{submittal.number}</h1>
        {!isEditing && (
          <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
            Edit
          </button>
        )}
      </div>

      <div className="card">
        {isEditing ? (
          <form onSubmit={handleSubmit}>
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

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Subcontractor</label>
                <input
                  type="text"
                  name="subcontractor"
                  className="form-input"
                  value={formData.subcontractor}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  name="status"
                  className="form-input"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="pending">Pending</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="approved_as_noted">Approved as Noted</option>
                  <option value="revise_resubmit">Revise & Resubmit</option>
                  <option value="rejected">Rejected</option>
                </select>
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
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsEditing(false);
                  if (submittal) {
                    setFormData({
                      spec_section: submittal.spec_section,
                      description: submittal.description,
                      subcontractor: submittal.subcontractor || '',
                      due_date: submittal.due_date || '',
                      status: submittal.status,
                    });
                  }
                }}
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
                Error updating submittal. Please try again.
              </div>
            )}
          </form>
        ) : (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <span className={getStatusBadge(submittal.status)} style={{ marginBottom: '1rem', display: 'inline-block' }}>
                {submittal.status.replace(/_/g, ' ')}
              </span>
              <h2 style={{ margin: '0 0 0.5rem 0' }}>{submittal.spec_section}</h2>
              <div style={{ color: 'var(--secondary)' }}>{submittal.description}</div>
            </div>

            {submittal.review_notes && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Review Notes
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{submittal.review_notes}</div>
                {submittal.reviewed_at && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginTop: '0.5rem' }}>
                    Reviewed on {format(new Date(submittal.reviewed_at), 'MMM d, yyyy')}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Subcontractor</div>
                <div>{submittal.subcontractor || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Due Date</div>
                <div>{submittal.due_date ? format(new Date(submittal.due_date), 'MMM d, yyyy') : '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Created By</div>
                <div>{submittal.created_by_name || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Created</div>
                <div>{format(new Date(submittal.created_at), 'MMM d, yyyy')}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmittalDetail;
