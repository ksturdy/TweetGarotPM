import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { submittalsApi } from '../../services/submittals';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';
import '../../styles/SalesPipeline.css';

const SubmittalList: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: submittals, isLoading } = useQuery({
    queryKey: ['submittals', projectId],
    queryFn: () => submittalsApi.getByProject(Number(projectId)).then((res) => res.data),
  });

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

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to={`/projects/${projectId}`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Project
            </Link>
            <h1>📎 Submittals</h1>
            <div className="sales-subtitle">{project?.name || 'Project'} - Submittals</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <Link to={`/projects/${projectId}/submittals/new`} className="btn btn-primary" style={{ textDecoration: 'none' }}>New Submittal</Link>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Spec Section</th>
              <th>Description</th>
              <th>Subcontractor</th>
              <th>Status</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {submittals?.map((submittal) => (
              <tr key={submittal.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/projects/${projectId}/submittals/${submittal.id}`}>
                <td><Link to={`/projects/${projectId}/submittals/${submittal.id}`}>{submittal.number}</Link></td>
                <td>{submittal.spec_section}</td>
                <td>{submittal.description}</td>
                <td>{submittal.subcontractor || '-'}</td>
                <td><span className={getStatusBadge(submittal.status)}>{submittal.status.replace(/_/g, ' ')}</span></td>
                <td>{submittal.due_date ? format(new Date(submittal.due_date), 'MMM d, yyyy') : '-'}</td>
              </tr>
            ))}
            {submittals?.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                  No submittals found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubmittalList;
