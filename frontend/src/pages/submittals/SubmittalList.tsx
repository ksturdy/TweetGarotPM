import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { submittalsApi } from '../../services/submittals';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';
import '../../styles/SalesPipeline.css';
import '../../styles/SubmittalList.css';

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

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  requested_from_vendor: { bg: '#fffbeb', color: '#b45309' },
  submitted_for_approval: { bg: '#eff6ff', color: '#1d4ed8' },
  revise_resubmit: { bg: '#fff7ed', color: '#c2410c' },
  approved: { bg: '#f0fdf4', color: '#15803d' },
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
          <Link to={`/projects/${projectId}/submittals/new`} className="btn btn-primary sales-btn-primary" style={{ textDecoration: 'none' }}>New Submittal</Link>
        </div>
      </div>

      {/* Desktop table */}
      <div className="card submittal-list-table">
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

      {/* Mobile cards */}
      <div className="submittal-list-cards">
        {submittals?.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--secondary)', padding: '2rem' }}>
            No submittals found
          </div>
        )}
        {submittals?.map((submittal) => {
          const sc = STATUS_COLOR[submittal.status] || { bg: '#f3f4f6', color: '#374151' };
          return (
            <Link
              key={submittal.id}
              to={`/projects/${projectId}/submittals/${submittal.id}`}
              className="submittal-card"
            >
              <div className="submittal-card-header">
                <span className="submittal-card-number">#{submittal.number}</span>
                <span className="submittal-card-status" style={{ background: sc.bg, color: sc.color }}>
                  {STATUS_LABEL[submittal.status] ?? submittal.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="submittal-card-name">{submittal.name || submittal.description}</div>
              {submittal.name && (
                <div className="submittal-card-desc">{submittal.description}</div>
              )}
              <div className="submittal-card-meta">
                {submittal.spec_section && <span>{submittal.spec_section}</span>}
                {submittal.subcontractor && <span>{submittal.subcontractor}</span>}
                {submittal.due_date && <span>Due {fmtDate(submittal.due_date)}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default SubmittalList;
