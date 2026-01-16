import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { rfisApi } from '../../services/rfis';
import { usersApi } from '../../services/users';

const RFIForm: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then((res) => res.data),
  });

  const [formData, setFormData] = useState({
    projectId: Number(projectId),
    subject: '',
    question: '',
    priority: 'normal',
    due_date: '',
    assigned_to: '',
    ball_in_court: '',
  });

  const createMutation = useMutation({
    mutationFn: rfisApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfis', projectId] });
      navigate(`/projects/${projectId}/rfis`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      projectId: formData.projectId,
      subject: formData.subject,
      question: formData.question,
      priority: formData.priority,
      assignedTo: formData.assigned_to ? Number(formData.assigned_to) : undefined,
      ballInCourt: formData.ball_in_court ? Number(formData.ball_in_court) : undefined,
      dueDate: formData.due_date || undefined,
    };
    createMutation.mutate(submitData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}/rfis`}>&larr; Back to RFIs</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>New RFI</h1>
      </div>

      <div className="card">
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
              onClick={() => navigate(`/projects/${projectId}/rfis`)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create RFI'}
            </button>
          </div>

          {createMutation.isError && (
            <div className="error-message" style={{ marginTop: '1rem' }}>
              Error creating RFI. Please try again.
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default RFIForm;
