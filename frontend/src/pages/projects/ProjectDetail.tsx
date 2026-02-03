import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { employeesApi, Employee } from '../../services/employees';
import { format } from 'date-fns';

// Market icons - matching opportunities
const MARKET_OPTIONS = [
  { value: 'Healthcare', icon: '🏥', label: 'Healthcare' },
  { value: 'Education', icon: '🏫', label: 'Education' },
  { value: 'Commercial', icon: '🏢', label: 'Commercial' },
  { value: 'Industrial', icon: '🏭', label: 'Industrial' },
  { value: 'Retail', icon: '🏬', label: 'Retail' },
  { value: 'Government', icon: '🏛️', label: 'Government' },
  { value: 'Hospitality', icon: '🏨', label: 'Hospitality' },
  { value: 'Data Center', icon: '💾', label: 'Data Center' }
];

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(Number(id)).then((res) => res.data),
  });

  const { data: employeesResponse } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.getAll(),
  });
  const employees = employeesResponse?.data?.data || [];

  const [formData, setFormData] = useState({
    name: '',
    number: '',
    client: '',
    address: '',
    start_date: '',
    end_date: '',
    status: '',
    description: '',
    market: '',
    manager_id: '',
  });

  React.useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        number: project.number,
        client: project.client,
        address: project.address || '',
        start_date: project.start_date || '',
        end_date: project.end_date || '',
        status: project.status,
        description: project.description || '',
        market: project.market || '',
        manager_id: project.manager_id?.toString() || '',
      });
    }
  }, [project]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => projectsApi.update(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsEditing(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      name: formData.name,
      number: formData.number,
      client: formData.client,
      address: formData.address || undefined,
      startDate: formData.start_date || undefined,
      endDate: formData.end_date || undefined,
      status: formData.status,
      description: formData.description || undefined,
      market: formData.market || undefined,
      managerId: formData.manager_id ? Number(formData.manager_id) : undefined,
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

  if (!project) {
    return <div className="card">Project not found</div>;
  }

  const modules = [
    { path: 'companies', label: 'Companies', description: 'Stakeholders and contacts' },
    { path: 'specifications', label: 'Specifications', description: 'Project specifications with Q&A' },
    { path: 'drawings', label: 'Drawings', description: 'Construction drawings and plans' },
    { path: 'rfis', label: 'RFIs', description: 'Requests for Information' },
    { path: 'submittals', label: 'Submittals', description: 'Shop drawings and product data' },
    { path: 'change-orders', label: 'Change Orders', description: 'Contract modifications' },
    { path: 'daily-reports', label: 'Daily Reports', description: 'Field activity logs' },
    { path: 'schedule', label: 'Schedule', description: 'Project timeline and milestones' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/projects">&larr; Back to Projects</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{project.name}</h1>
        {!isEditing && (
          <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
            Edit Project
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        {isEditing ? (
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Project Name *</label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Project Number *</label>
                <input
                  type="text"
                  name="number"
                  className="form-input"
                  value={formData.number}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Client *</label>
              <input
                type="text"
                name="client"
                className="form-input"
                value={formData.client}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input
                type="text"
                name="address"
                className="form-input"
                value={formData.address}
                onChange={handleChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  name="status"
                  className="form-input"
                  value={formData.status}
                  onChange={handleChange}
                  required
                >
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Market</label>
                <select
                  name="market"
                  className="form-input"
                  value={formData.market}
                  onChange={handleChange}
                >
                  <option value="">Select Market</option>
                  {MARKET_OPTIONS.map((market) => (
                    <option key={market.value} value={market.value}>
                      {market.icon} {market.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Project Manager</label>
                <select
                  name="manager_id"
                  className="form-input"
                  value={formData.manager_id}
                  onChange={handleChange}
                >
                  <option value="">Select Manager</option>
                  {employees?.filter((emp: Employee) =>
                    // Show active employees, OR the currently assigned manager (even if inactive)
                    emp.employment_status === 'active' || emp.id.toString() === formData.manager_id
                  ).map((emp: Employee) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}{emp.employment_status !== 'active' ? ' (Inactive)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  className="form-input"
                  value={formData.start_date}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  name="end_date"
                  className="form-input"
                  value={formData.end_date}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                className="form-input"
                rows={4}
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsEditing(false);
                  if (project) {
                    setFormData({
                      name: project.name,
                      number: project.number,
                      client: project.client,
                      address: project.address || '',
                      start_date: project.start_date || '',
                      end_date: project.end_date || '',
                      status: project.status,
                      description: project.description || '',
                      market: project.market || '',
                      manager_id: project.manager_id?.toString() || '',
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
                Error updating project. Please try again.
              </div>
            )}
          </form>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>{project.number}</div>
                <div style={{ color: 'var(--secondary)', marginTop: '0.25rem' }}>{project.client}</div>
              </div>
              <span className={`badge badge-${project.status === 'active' ? 'success' : 'info'}`}>
                {project.status.replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Address</div>
                <div>{project.address || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Market</div>
                <div>
                  {project.market ? (
                    <>
                      {MARKET_OPTIONS.find(m => m.value === project.market)?.icon || ''} {project.market}
                    </>
                  ) : '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Project Manager</div>
                <div>{project.manager_name || '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Start Date</div>
                <div>{project.start_date ? format(new Date(project.start_date), 'MMM d, yyyy') : '-'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>End Date</div>
                <div>{project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : '-'}</div>
              </div>
            </div>

            {project.description && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Description</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{project.description}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Financial Information */}
      {(project.contract_value || project.gross_margin_percent !== undefined || project.backlog) && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>Financial Overview</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Contract Amount</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--primary)' }}>
                {project.contract_value ? `$${Number(project.contract_value).toLocaleString()}` : '-'}
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Gross Margin</div>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: 600,
                color: project.gross_margin_percent && project.gross_margin_percent > 0 ? '#10b981' : project.gross_margin_percent && project.gross_margin_percent < 0 ? '#ef4444' : 'var(--text)'
              }}>
                {project.gross_margin_percent !== undefined && project.gross_margin_percent !== null
                  ? `${(Number(project.gross_margin_percent) * 100).toFixed(1)}%`
                  : '-'}
              </div>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Backlog</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--primary)' }}>
                {project.backlog ? `$${Number(project.backlog).toLocaleString()}` : '-'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Project Modules</h2>
        <Link to={`/projects/${id}/rfis/new`} className="btn btn-primary">
          Create New RFI
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
        {modules.map((module) => (
          <Link
            key={module.path}
            to={`/projects/${id}/${module.path}`}
            className="card"
            style={{ textDecoration: 'none', color: 'inherit', transition: 'transform 0.2s' }}
          >
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)' }}>{module.label}</h3>
            <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', margin: 0 }}>{module.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ProjectDetail;
