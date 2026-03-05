import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fieldIssuesApi, TRADE_OPTIONS, PRIORITY_OPTIONS } from '../../services/fieldIssues';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';
import '../../styles/SalesPipeline.css';

const ProjectIssueList: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: issues, isLoading } = useQuery({
    queryKey: ['field-issues', projectId],
    queryFn: () => fieldIssuesApi.getByProject(Number(projectId)).then((res) => res.data),
  });

  const getPriorityBadge = (priority: string) => {
    const classes: Record<string, string> = {
      low: 'badge-info',
      normal: 'badge-info',
      high: 'badge-warning',
      urgent: 'badge-danger',
    };
    return `badge ${classes[priority] || 'badge-info'}`;
  };

  const filteredIssues = statusFilter === 'all'
    ? issues
    : issues?.filter(issue => issue.status === statusFilter);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to={`/projects/${projectId}`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Project
            </Link>
            <h1>⚠️ Field Issues</h1>
            <div className="sales-subtitle">{project?.name || 'Project'} - Issues Reported from the Field</div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e0e2e7'
      }}>
        <label htmlFor="status-filter" style={{ fontWeight: 500, color: '#5a5a72', fontSize: '0.875rem' }}>
          Filter by Status:
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sales-filter-btn"
          style={{ cursor: 'pointer' }}
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
        </select>
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <table className="sales-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Priority</th>
              <th>Trade</th>
              <th>Location</th>
              <th>Created By</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredIssues?.map((issue) => {
              const tradeLabel = TRADE_OPTIONS.find(t => t.value === issue.trade)?.label || issue.trade;
              const priorityLabel = PRIORITY_OPTIONS.find(p => p.value === issue.priority)?.label || issue.priority;
              return (
                <tr
                  key={issue.id}
                  onClick={() => navigate(`/projects/${projectId}/issues/${issue.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                      ISS-{issue.number}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{issue.title}</td>
                  <td>
                    <span className={`sales-stage-badge ${issue.priority === 'urgent' ? 'lost' : issue.priority === 'high' ? 'quoted' : 'won'}`}>
                      <span className="sales-stage-dot"></span>
                      {priorityLabel}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.875rem', color: '#5a5a72' }}>{tradeLabel || '-'}</td>
                  <td style={{ fontSize: '0.875rem', color: '#5a5a72' }}>{issue.location || '-'}</td>
                  <td style={{ fontSize: '0.875rem' }}>{issue.created_by_name}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'white',
                      backgroundColor: issue.status === 'submitted' ? '#3b82f6' : '#f59e0b',
                      textTransform: 'capitalize',
                    }}>
                      {issue.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.875rem', color: '#5a5a72' }}>
                    {format(new Date(issue.created_at), 'MMM d, yyyy')}
                  </td>
                </tr>
              );
            })}
            {filteredIssues?.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#8888a0', padding: '3rem' }}>
                  No field issues found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectIssueList;
