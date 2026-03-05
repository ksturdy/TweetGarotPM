import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fieldIssuesApi, TRADE_OPTIONS, PRIORITY_OPTIONS } from '../../services/fieldIssues';
import { projectsApi } from '../../services/projects';
import { format } from 'date-fns';
import FieldPhotoUpload from '../../components/field/FieldPhotoUpload';
import '../../styles/SalesPipeline.css';

const labelStyle: React.CSSProperties = { fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' };
const valStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 500 };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #e5e7eb', paddingBottom: 4, marginBottom: 6 };

const priorityColors: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  normal: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  high: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  urgent: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

const ProjectIssueDetail: React.FC = () => {
  const { projectId, id } = useParams<{ projectId: string; id: string }>();

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((res) => res.data),
  });

  const { data: issue, isLoading } = useQuery({
    queryKey: ['field-issue', id],
    queryFn: () => fieldIssuesApi.getById(Number(id)).then((res) => res.data),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!issue) {
    return <div className="loading">Issue not found</div>;
  }

  const tradeLabel = TRADE_OPTIONS.find(t => t.value === issue.trade)?.label;
  const priorityLabel = PRIORITY_OPTIONS.find(p => p.value === issue.priority)?.label || issue.priority;
  const pColor = priorityColors[issue.priority] || priorityColors.normal;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to={`/projects/${projectId}/issues`} style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Field Issues
            </Link>
            <h1>ISS-{issue.number}</h1>
            <div className="sales-subtitle">{issue.title}</div>
          </div>
        </div>
        <div>
          <span style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'white',
            backgroundColor: issue.status === 'submitted' ? '#3b82f6' : '#f59e0b',
            textTransform: 'capitalize',
          }}>
            {issue.status}
          </span>
        </div>
      </div>

      {/* Badges */}
      <div style={{ marginBottom: 16 }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: 16,
          fontSize: 13,
          fontWeight: 600,
          background: pColor.bg,
          color: pColor.text,
          border: `1px solid ${pColor.border}`,
        }}>
          {priorityLabel}
        </span>
        {tradeLabel && (
          <span style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: 16,
            fontSize: 13,
            fontWeight: 600,
            marginLeft: 8,
            background: '#f3f4f6',
            color: '#374151',
            border: '1px solid #e5e7eb',
          }}>
            {tradeLabel}
          </span>
        )}
      </div>

      {/* Details Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={sectionTitle}>Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginTop: 8 }}>
          <div>
            <div style={labelStyle}>Project</div>
            <div style={valStyle}>{project?.name || issue.project_name || '-'}</div>
          </div>
          <div>
            <div style={labelStyle}>Location</div>
            <div style={valStyle}>{issue.location || '-'}</div>
          </div>
          <div>
            <div style={labelStyle}>Created By</div>
            <div style={valStyle}>{issue.created_by_name}</div>
          </div>
          <div>
            <div style={labelStyle}>Date</div>
            <div style={valStyle}>{format(new Date(issue.created_at), 'MMM d, yyyy h:mm a')}</div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={sectionTitle}>Description</h3>
        <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 8 }}>
          {issue.description || '-'}
        </div>
      </div>

      {/* Notes */}
      {issue.notes && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={sectionTitle}>Additional Notes</h3>
          <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 8 }}>
            {issue.notes}
          </div>
        </div>
      )}

      {/* Photos */}
      <div className="card" style={{ marginBottom: 16 }}>
        <FieldPhotoUpload entityType="field_issue" entityId={issue.id} />
      </div>
    </div>
  );
};

export default ProjectIssueDetail;
