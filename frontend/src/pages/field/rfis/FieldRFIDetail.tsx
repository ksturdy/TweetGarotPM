import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import EditIcon from '@mui/icons-material/Edit';
import { rfisApi } from '../../../services/rfis';
import FieldPhotoUpload from '../../../components/field/FieldPhotoUpload';

const priorityColors: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  normal: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  high: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  urgent: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};

const FieldRFIDetail: React.FC = () => {
  const { projectId, id } = useParams();
  const navigate = useNavigate();

  const { data: rfi, isLoading } = useQuery({
    queryKey: ['field-rfi', id],
    queryFn: async () => {
      const res = await rfisApi.getById(Number(id));
      return res.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="field-loading">Loading RFI...</div>;
  }

  if (!rfi) {
    return <div className="field-loading">RFI not found</div>;
  }

  const pColor = priorityColors[rfi.priority] || priorityColors.normal;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 className="field-page-title">RFI-{rfi.number}</h1>
          <p className="field-page-subtitle" style={{ marginBottom: 0 }}>
            {rfi.subject}
          </p>
        </div>
        <span className={`field-status field-status-${rfi.status}`}>
          {rfi.status}
        </span>
      </div>

      {/* Priority & Discipline Badges */}
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
          {rfi.priority.charAt(0).toUpperCase() + rfi.priority.slice(1)}
        </span>
        {rfi.discipline && (
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
            {rfi.discipline.charAt(0).toUpperCase() + rfi.discipline.slice(1)}
          </span>
        )}
      </div>

      {/* Details Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Details</div>
        {rfi.project_name && (
          <div className="field-detail-row">
            <span className="field-detail-label">Project</span>
            <span className="field-detail-value">
              {rfi.project_name}{rfi.project_number ? ` (${rfi.project_number})` : ''}
            </span>
          </div>
        )}
        {rfi.drawing_sheet && (
          <div className="field-detail-row">
            <span className="field-detail-label">Drawing Sheet</span>
            <span className="field-detail-value">{rfi.drawing_sheet}</span>
          </div>
        )}
        {rfi.spec_section && (
          <div className="field-detail-row">
            <span className="field-detail-label">Spec Section</span>
            <span className="field-detail-value">{rfi.spec_section}</span>
          </div>
        )}
        <div className="field-detail-row">
          <span className="field-detail-label">Created By</span>
          <span className="field-detail-value">{rfi.created_by_name}</span>
        </div>
      </div>

      {/* Question Section */}
      <div className="field-detail-section">
        <div className="field-detail-section-title">Question</div>
        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {rfi.question || '-'}
        </div>
      </div>

      {/* Response Section (if answered) */}
      {rfi.response && (
        <div className="field-detail-section">
          <div className="field-detail-section-title">Response</div>
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {rfi.response}
          </div>
          {rfi.responded_by_name && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
              Responded by: {rfi.responded_by_name}
            </div>
          )}
        </div>
      )}

      {/* Photos */}
      <FieldPhotoUpload entityType="rfi" entityId={rfi.id} />

      {/* Edit Button (only for open, field-submitted RFIs) */}
      {rfi.status === 'open' && rfi.source === 'field' && (
        <div className="field-actions-bar">
          <button
            className="field-btn field-btn-primary"
            onClick={() =>
              navigate(`/field/projects/${projectId}/rfis/${id}/edit`)
            }
            type="button"
          >
            <EditIcon style={{ fontSize: 18 }} />
            Edit
          </button>
        </div>
      )}
    </div>
  );
};

export default FieldRFIDetail;
