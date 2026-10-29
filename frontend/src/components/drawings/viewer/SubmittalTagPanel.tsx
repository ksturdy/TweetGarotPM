import React from 'react';
import type { DrawingSubmittalTag } from '../../../lib/drawingViewer/types';

interface Props {
  tag: DrawingSubmittalTag;
  projectId: number;
  onClose: () => void;
  onDelete: (id: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', under_review: 'Under Review',
  approved: 'Approved', approved_as_noted: 'Approved as Noted',
  rejected: 'Rejected', revise_resubmit: 'Revise & Resubmit',
};
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', under_review: '#3b82f6',
  approved: '#22c55e', approved_as_noted: '#84cc16',
  rejected: '#ef4444', revise_resubmit: '#f97316',
};

export default function SubmittalTagPanel({ tag, projectId, onClose, onDelete }: Props) {
  const statusColor = STATUS_COLORS[tag.submittal_status || ''] || '#7a9ab5';
  const statusLabel = STATUS_LABELS[tag.submittal_status || ''] || tag.submittal_status || 'Unknown';

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ color: '#7a9ab5', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
            Submittal Tag
          </div>
          {tag.submittal_number != null && (
            <div style={{ color: '#7a9ab5', fontSize: 12, marginTop: 2 }}>
              SUB-{tag.submittal_number}
            </div>
          )}
          {tag.submittal_name && (
            <div style={{ color: '#cdd8e5', fontSize: 14, fontWeight: 600, marginTop: 4 }}>
              {tag.submittal_name}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#7a9ab5', cursor: 'pointer', fontSize: 18 }}
        >
          ×
        </button>
      </div>

      {tag.submittal_status && (
        <div style={{ marginBottom: 12 }}>
          <span style={{
            background: `${statusColor}22`,
            color: statusColor,
            borderRadius: 4, padding: '3px 10px', fontSize: 12,
            border: `1px solid ${statusColor}44`,
          }}>
            {statusLabel}
          </span>
        </div>
      )}

      {tag.submittal_id && (
        <a
          href={`/projects/${projectId}/submittals/${tag.submittal_id}`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'block', marginBottom: 12,
            color: '#2d72d9', fontSize: 12,
            textDecoration: 'none',
          }}
        >
          Open Submittal →
        </a>
      )}

      {!tag.submittal_id && (
        <div style={{ color: '#4a6480', fontSize: 12, marginBottom: 12 }}>
          No submittal linked yet.
        </div>
      )}

      <button
        onClick={() => onDelete(tag.id)}
        style={{
          background: 'transparent', border: '1px solid #7f1d1d',
          color: '#ef4444', borderRadius: 6, padding: '6px 12px',
          fontSize: 12, cursor: 'pointer', width: '100%',
        }}
      >
        Delete Tag
      </button>
    </div>
  );
}
