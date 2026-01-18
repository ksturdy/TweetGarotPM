import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rfisApi } from '../../services/rfis';
import { projectsApi } from '../../services/projects';
import { usersApi } from '../../services/users';
import { format } from 'date-fns';
import RFIPreviewModal from '../../components/rfis/RFIPreviewModal';

const RFIDetail: React.FC = () => {
  const { projectId, id } = useParams<{ projectId: string; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: rfi, isLoading } = useQuery({
    queryKey: ['rfi', id],
    queryFn: () => rfisApi.getById(Number(id)).then((res) => res.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then((res) => res.data),
  });

  const [formData, setFormData] = useState({
    subject: '',
    question: '',
    priority: 'normal',
    due_date: '',
    status: 'open',
    assigned_to: '',
    ball_in_court: '',
  });

  React.useEffect(() => {
    if (rfi) {
      setFormData({
        subject: rfi.subject,
        question: rfi.question,
        priority: rfi.priority,
        due_date: rfi.due_date || '',
        status: rfi.status,
        assigned_to: rfi.assigned_to?.toString() || '',
        ball_in_court: rfi.ball_in_court?.toString() || '',
      });
    }
  }, [rfi]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => rfisApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfi', id] });
      queryClient.invalidateQueries({ queryKey: ['rfis', projectId] });
      setIsEditing(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      subject: formData.subject,
      question: formData.question,
      priority: formData.priority,
      dueDate: formData.due_date || undefined,
      status: formData.status,
      assignedTo: formData.assigned_to ? Number(formData.assigned_to) : undefined,
      ballInCourt: formData.ball_in_court ? Number(formData.ball_in_court) : undefined,
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

  if (!rfi) {
    return <div className="card">RFI not found</div>;
  }

  const getPriorityBadge = (priority: string) => {
    const classes: Record<string, string> = {
      low: 'badge-info',
      normal: 'badge-info',
      high: 'badge-warning',
      urgent: 'badge-danger',
    };
    return `badge ${classes[priority] || 'badge-info'}`;
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      open: 'badge-warning',
      answered: 'badge-success',
      closed: 'badge-info',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}/rfis`}>&larr; Back to RFIs</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>RFI #{rfi.number}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!isEditing && (
            <>
              <button className="btn btn-primary" onClick={() => setIsPreviewOpen(true)}>
                View RFI
              </button>
              <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                Edit
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Subject *</label>
              <input
                type="text"
                name="subject"
                className="form-input"
                value={formData.subject}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Question *</label>
              <textarea
                name="question"
                className="form-input"
                rows={6}
                value={formData.question}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  name="priority"
                  className="form-input"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  name="status"
                  className="form-input"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="open">Open</option>
                  <option value="answered">Answered</option>
                  <option value="closed">Closed</option>
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

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Assigned To</label>
                <select
                  name="assigned_to"
                  className="form-input"
                  value={formData.assigned_to}
                  onChange={handleChange}
                >
                  <option value="">Select User</option>
                  {users?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ball in Court</label>
                <select
                  name="ball_in_court"
                  className="form-input"
                  value={formData.ball_in_court}
                  onChange={handleChange}
                >
                  <option value="">Select User</option>
                  {users?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsEditing(false);
                  if (rfi) {
                    setFormData({
                      subject: rfi.subject,
                      question: rfi.question,
                      priority: rfi.priority,
                      due_date: rfi.due_date || '',
                      status: rfi.status,
                      assigned_to: rfi.assigned_to?.toString() || '',
                      ball_in_court: rfi.ball_in_court?.toString() || '',
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
                Error updating RFI. Please try again.
              </div>
            )}
          </form>
        ) : (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <span className={getPriorityBadge(rfi.priority)}>{rfi.priority}</span>
                <span className={getStatusBadge(rfi.status)}>{rfi.status}</span>
              </div>
              <h2 style={{ margin: '0 0 1rem 0' }}>{rfi.subject}</h2>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Question
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{rfi.question}</div>
            </div>

            {rfi.response && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Response
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{rfi.response}</div>
                {rfi.responded_at && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginTop: '0.5rem' }}>
                    Responded on {format(new Date(rfi.responded_at), 'MMM d, yyyy')}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Due Date</div>
                <div>{rfi.due_date ? format(new Date(rfi.due_date), 'MMM d, yyyy') : '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Assigned To</div>
                <div>{rfi.assigned_to_name || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Ball in Court</div>
                <div>{rfi.ball_in_court_name || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Created By</div>
                <div>{rfi.created_by_name || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Created</div>
                <div>{format(new Date(rfi.created_at), 'MMM d, yyyy')}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <RFIPreviewModal
        rfi={rfi}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
};

export default RFIDetail;
