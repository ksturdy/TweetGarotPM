import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, Project } from '../../services/projects';

const ProjectList: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', statusFilter],
    queryFn: () => projectsApi.getAll({ status: statusFilter || undefined }).then((res) => res.data),
  });

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      active: 'badge-success',
      on_hold: 'badge-warning',
      completed: 'badge-info',
      cancelled: 'badge-danger',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Projects</h1>
        <Link to="/projects/new" className="btn btn-primary">
          New Project
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Filter by Status</label>
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: '200px' }}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Name</th>
              <th>Client</th>
              <th>Status</th>
              <th>Manager</th>
            </tr>
          </thead>
          <tbody>
            {projects?.map((project: Project) => (
              <tr key={project.id}>
                <td>
                  <Link to={`/projects/${project.id}`}>{project.number}</Link>
                </td>
                <td>
                  <Link to={`/projects/${project.id}`}>{project.name}</Link>
                </td>
                <td>{project.client}</td>
                <td>
                  <span className={getStatusBadge(project.status)}>
                    {project.status.replace('_', ' ')}
                  </span>
                </td>
                <td>{project.manager_name || '-'}</td>
              </tr>
            ))}
            {projects?.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                  No projects found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectList;
