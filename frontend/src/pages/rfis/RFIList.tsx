import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { rfisApi } from '../../services/rfis';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';

const RFIList: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: rfis, isLoading } = useQuery({
    queryKey: ['rfis', projectId],
    queryFn: () => rfisApi.getByProject(Number(projectId)).then((res) => res.data),
  });

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      open: 'badge-warning',
      answered: 'badge-success',
      closed: 'badge-info',
    };
    return `badge ${classes[status] || 'badge-info'}`;
  };

  const getPriorityBadge = (priority: string) => {
    const classes: Record<string, string> = {
      low: 'badge-info',
      normal: 'badge-info',
      high: 'badge-warning',
      urgent: 'badge-danger',
    };
    return `badge ${classes[priority] || 'badge-info'}`;
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to={`/projects/${projectId}`}>&larr; Back to {project?.name || 'Project'}</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>RFIs</h1>
        <Link to={`/projects/${projectId}/rfis/new`} className="btn btn-primary">New RFI</Link>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Subject</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Assigned To</th>
              <th>Ball in Court</th>
              <th style={{ width: '200px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rfis?.map((rfi) => (
              <tr key={rfi.id}>
                <td><Link to={`/projects/${projectId}/rfis/${rfi.id}`}>{rfi.number}</Link></td>
                <td>{rfi.subject}</td>
                <td><span className={getPriorityBadge(rfi.priority)}>{rfi.priority}</span></td>
                <td><span className={getStatusBadge(rfi.status)}>{rfi.status}</span></td>
                <td>{rfi.due_date ? format(new Date(rfi.due_date), 'MMM d, yyyy') : '-'}</td>
                <td>{rfi.assigned_to_name || '-'}</td>
                <td>{rfi.ball_in_court_name || '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link
                      to={`/projects/${projectId}/rfis/${rfi.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      Edit
                    </Link>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => alert('Preview functionality coming soon')}
                    >
                      Preview
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => alert('Send functionality coming soon')}
                    >
                      Send
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => alert('PDF generation coming soon')}
                    >
                      PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rfis?.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                  No RFIs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RFIList;
