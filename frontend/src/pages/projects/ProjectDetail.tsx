import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getById(Number(id)).then((res) => res.data),
  });

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!project) {
    return <div className="card">Project not found</div>;
  }

  const modules = [
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

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>{project.number}</div>
            <h1 style={{ margin: '0.25rem 0', fontSize: '1.75rem' }}>{project.name}</h1>
            <div style={{ color: 'var(--secondary)' }}>{project.client}</div>
          </div>
          <span className={`badge badge-${project.status === 'active' ? 'success' : 'info'}`}>
            {project.status.replace('_', ' ')}
          </span>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase' }}>Address</div>
            <div>{project.address || '-'}</div>
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
            <div>{project.description}</div>
          </div>
        )}
      </div>

      <h2 style={{ marginBottom: '1rem' }}>Project Modules</h2>
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
