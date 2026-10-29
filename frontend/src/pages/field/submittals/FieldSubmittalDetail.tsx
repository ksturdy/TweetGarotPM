import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { submittalsApi } from '../../../services/submittals';
import { useTitanFeedback } from '../../../context/TitanFeedbackContext';

const STATUS_LABEL: Record<string, string> = {
  requested_from_vendor: 'Requested from Vendor',
  submitted_for_approval: 'Submitted for Approval',
  revise_resubmit: 'Revise & Resubmit',
  approved: 'Approved',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  requested_from_vendor: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  submitted_for_approval: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  revise_resubmit: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  approved: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
};

const fmtDate = (v: string | null | undefined): string => {
  if (!v) return '—';
  const d = new Date(v.includes('T') ? v : v + 'T00:00:00');
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const FieldSubmittalDetail: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();

  const { data: sub, isLoading } = useQuery({
    queryKey: ['field-submittal', id],
    queryFn: async () => {
      const res = await submittalsApi.getById(Number(id));
      return res.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="field-loading">Loading submittal...</div>;
  }

  if (!sub) {
    return <div className="field-loading">Submittal not found</div>;
  }

  const sc = STATUS_COLORS[sub.status] || STATUS_COLORS.submitted_for_approval;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 className="field-page-title">SUB-{sub.number}</h1>
          <p className="field-page-subtitle" style={{ marginBottom: 0 }}>
            {sub.name || sub.description}
          </p>
        </div>
        <span style={{
          display: 'inline-block',
          padding: '4px 12px',
          borderRadius: 14,
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          background: sc.bg,
          color: sc.text,
          border: `1px solid ${sc.border}`,
        }}>
          {STATUS_LABEL[sub.status] ?? sub.status}
        </span>
      </div>

      {/* Details */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Details</div>
        {sub.spec_section && (
          <div className="field-detail-row">
            <span className="field-detail-label">Spec Section</span>
            <span className="field-detail-value">{sub.spec_section}</span>
          </div>
        )}
        {sub.subcontractor && (
          <div className="field-detail-row">
            <span className="field-detail-label">Vendor / Supplier</span>
            <span className="field-detail-value">{sub.subcontractor}</span>
          </div>
        )}
        {sub.due_date && (
          <div className="field-detail-row">
            <span className="field-detail-label">Due Date</span>
            <span className="field-detail-value">{fmtDate(sub.due_date)}</span>
          </div>
        )}
        {sub.created_by_name && (
          <div className="field-detail-row">
            <span className="field-detail-label">Created By</span>
            <span className="field-detail-value">{sub.created_by_name}</span>
          </div>
        )}
        <div className="field-detail-row">
          <span className="field-detail-label">Date Created</span>
          <span className="field-detail-value">{fmtDate(sub.created_at)}</span>
        </div>
      </div>

      {/* Description */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Description</div>
        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {sub.description || '—'}
        </div>
      </div>

      {/* Review Notes */}
      {sub.review_notes && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Review Notes</div>
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {sub.review_notes}
          </div>
          {sub.reviewed_at && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
              Reviewed: {fmtDate(sub.reviewed_at)}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="field-actions-bar">
        <button
          className="field-btn field-btn-primary"
          onClick={() => navigate(`/field/projects/${projectId}/submittals/${id}/edit`)}
          type="button"
        >
          <EditIcon style={{ fontSize: 18 }} />
          Edit
        </button>
        <button
          className="field-btn field-btn-danger field-btn-sm"
          type="button"
          style={{ width: 'auto', minWidth: 48 }}
          onClick={async () => {
            const ok = await confirm({
              message: 'Are you sure you want to delete this submittal? This action cannot be undone.',
              danger: true,
            });
            if (ok) {
              await submittalsApi.delete(Number(id));
              queryClient.invalidateQueries({ queryKey: ['field-submittals', projectId] });
              queryClient.invalidateQueries({ queryKey: ['submittals', projectId] });
              navigate(`/field/projects/${projectId}/submittals`);
            }
          }}
        >
          <DeleteIcon style={{ fontSize: 18 }} />
        </button>
      </div>
    </div>
  );
};

export default FieldSubmittalDetail;
