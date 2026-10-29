import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { submittalsApi } from '../../services/submittals';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';
import '../../styles/SalesPipeline.css';

const fmtDate = (v: string | null | undefined): string => {
  if (!v) return '-';
  const d = new Date(v.includes('T') ? v : v + 'T00:00:00');
  return isNaN(d.getTime()) ? '-' : format(d, 'MMM d, yyyy');
};

const STATUS_BADGE: Record<string, string> = {
  requested_from_vendor: 'badge-warning',
  submitted_for_approval: 'badge-info',
  revise_resubmit: 'badge-warning',
  approved: 'badge-success',
};

const STATUS_LABEL: Record<string, string> = {
  requested_from_vendor: 'Requested from Vendor',
  submitted_for_approval: 'Submitted for Approval',
  revise_resubmit: 'Revise and Resubmit',
  approved: 'Approved',
};

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
              <th>Name</th>
              <th>Spec Section</th>
              <th>Description</th>
              <th>Vendor/Supplier</th>
              <th>Status</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {submittals?.map((submittal) => (
              <tr key={submittal.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/projects/${projectId}/submittals/${submittal.id}`}>
                <td><Link to={`/projects/${projectId}/submittals/${submittal.id}`}>{submittal.number}</Link></td>
                <td>{submittal.name || '-'}</td>
                <td>{submittal.spec_section}</td>
                <td>{submittal.description}</td>
                <td>{submittal.subcontractor || '-'}</td>
                <td>
                  <span className={`badge ${STATUS_BADGE[submittal.status] || 'badge-info'}`}>
                    {STATUS_LABEL[submittal.status] ?? submittal.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td>{fmtDate(submittal.due_date)}</td>
              </tr>
            ))}
            {submittals?.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
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
