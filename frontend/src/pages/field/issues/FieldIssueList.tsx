import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import BugReportIcon from '@mui/icons-material/BugReport';
import { fieldIssuesApi, FieldIssue, TRADE_OPTIONS } from '../../../services/fieldIssues';

const truncate = (text: string, maxLength: number): string => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

const statusFilters = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
];

const priorityColors: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  normal: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  high: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  urgent: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

const FieldIssueList: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['field-issues', projectId, statusFilter],
    queryFn: async () => {
      const filters = statusFilter ? { status: statusFilter } : undefined;
      const res = await fieldIssuesApi.getByProject(Number(projectId), filters);
      return res.data;
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return <div className="field-loading">Loading issues...</div>;
  }

  return (
    <div>
      <h1 className="field-page-title">Issues</h1>
      <p className="field-page-subtitle">Report and track field issues</p>

      <div className="field-filters">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            className={`field-filter-chip ${statusFilter === filter.value ? 'active' : ''}`}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {issues.length === 0 ? (
        <div className="field-empty">
          <BugReportIcon />
          <div className="field-empty-title">No issues found</div>
          <div className="field-empty-text">
            Tap the + button to report a new issue
          </div>
        </div>
      ) : (
        issues.map((issue: FieldIssue) => {
          const pColor = priorityColors[issue.priority] || priorityColors.normal;
          const tradeLabel = TRADE_OPTIONS.find(t => t.value === issue.trade)?.label;
          return (
            <div
              key={issue.id}
              className="field-card"
              onClick={() =>
                navigate(`/field/projects/${projectId}/issues/${issue.id}`)
              }
            >
              <div className="field-card-header">
                <div>
                  <div className="field-card-number">ISS-{issue.number}</div>
                  <div className="field-card-title">
                    {truncate(issue.title, 60)}
                  </div>
                </div>
                <span className={`field-status field-status-${issue.status}`}>
                  {issue.status}
                </span>
              </div>
              <div className="field-card-subtitle">
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 600,
                  marginRight: 8,
                  background: pColor.bg,
                  color: pColor.text,
                  border: `1px solid ${pColor.border}`,
                }}>
                  {issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}
                </span>
                {tradeLabel && (
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 600,
                    marginRight: 8,
                    background: '#f3f4f6',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                  }}>
                    {tradeLabel}
                  </span>
                )}
                {issue.location && `${issue.location}`}
              </div>
              <div className="field-card-meta">
                <span>By {issue.created_by_name}</span>
              </div>
            </div>
          );
        })
      )}

      <button
        className="field-fab"
        onClick={() =>
          navigate(`/field/projects/${projectId}/issues/new`)
        }
        aria-label="Create issue"
      >
        <AddIcon />
      </button>
    </div>
  );
};

export default FieldIssueList;
