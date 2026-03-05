import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { fieldIssuesApi, TRADE_OPTIONS, PRIORITY_OPTIONS } from '../../../services/fieldIssues';
import FieldPhotoUpload from '../../../components/field/FieldPhotoUpload';

const priorityColors: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  normal: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  high: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  urgent: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

const FieldIssueDetail: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: issue, isLoading } = useQuery({
    queryKey: ['field-issue', id],
    queryFn: async () => {
      const res = await fieldIssuesApi.getById(Number(id));
      return res.data;
    },
    enabled: !!id,
  });

  const submitMutation = useMutation({
    mutationFn: () => fieldIssuesApi.submit(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-issue', id] });
      queryClient.invalidateQueries({ queryKey: ['field-issues', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => fieldIssuesApi.delete(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-issues', projectId] });
      navigate(`/field/projects/${projectId}/issues`);
    },
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this issue?')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="field-loading">Loading issue...</div>;
  }

  if (!issue) {
    return <div className="field-loading">Issue not found</div>;
  }

  const pColor = priorityColors[issue.priority] || priorityColors.normal;
  const tradeLabel = TRADE_OPTIONS.find(t => t.value === issue.trade)?.label;
  const priorityLabel = PRIORITY_OPTIONS.find(p => p.value === issue.priority)?.label || issue.priority;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 className="field-page-title">ISS-{issue.number}</h1>
          <p className="field-page-subtitle" style={{ marginBottom: 0 }}>
            {issue.title}
          </p>
        </div>
        <span className={`field-status field-status-${issue.status}`}>
          {issue.status}
        </span>
      </div>

      {/* Priority Badge */}
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

      {/* Details Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Details</div>
        {issue.project_name && (
          <div className="field-detail-row">
            <span className="field-detail-label">Project</span>
            <span className="field-detail-value">
              {issue.project_name}{issue.project_number ? ` (${issue.project_number})` : ''}
            </span>
          </div>
        )}
        {issue.location && (
          <div className="field-detail-row">
            <span className="field-detail-label">Location</span>
            <span className="field-detail-value">{issue.location}</span>
          </div>
        )}
        <div className="field-detail-row">
          <span className="field-detail-label">Created By</span>
          <span className="field-detail-value">{issue.created_by_name}</span>
        </div>
      </div>

      {/* Description Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Description</div>
        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {issue.description || '-'}
        </div>
      </div>

      {/* Notes Section */}
      {issue.notes && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Additional Notes</div>
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {issue.notes}
          </div>
        </div>
      )}

      {/* Photos */}
      <FieldPhotoUpload entityType="field_issue" entityId={issue.id} />

      {/* Action Buttons */}
      {issue.status === 'draft' && (
        <div className="field-actions-bar">
          <button
            className="field-btn field-btn-success"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            type="button"
          >
            <CheckCircleIcon style={{ fontSize: 18 }} />
            {submitMutation.isPending ? 'Submitting...' : 'Submit'}
          </button>
          <button
            className="field-btn field-btn-primary"
            onClick={() =>
              navigate(`/field/projects/${projectId}/issues/${id}/edit`)
            }
            type="button"
          >
            <EditIcon style={{ fontSize: 18 }} />
            Edit
          </button>
          <button
            className="field-btn field-btn-danger field-btn-sm"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            type="button"
            style={{ width: 'auto', minWidth: 48 }}
          >
            <DeleteIcon style={{ fontSize: 18 }} />
          </button>
        </div>
      )}
    </div>
  );
};

export default FieldIssueDetail;
