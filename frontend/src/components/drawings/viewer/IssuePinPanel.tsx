import React from 'react';
import type { DrawingIssuePin } from '../../../lib/drawingViewer/types';

interface Props {
  pin: DrawingIssuePin;
  projectId: number;
  onClose: () => void;
  onDelete: (id: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', open: 'Open', in_progress: 'In Progress',
  resolved: 'Resolved', closed: 'Closed',
};
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low', normal: 'Normal', high: 'High', critical: 'Critical',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: '#22c55e', normal: '#3b82f6', high: '#f59e0b', critical: '#ef4444',
};

export default function IssuePinPanel({ pin, projectId, onClose, onDelete }: Props) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ color: '#7a9ab5', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
            Issue Pin #{pin.pin_number}
          </div>
          {pin.issue_title && (
            <div style={{ color: '#cdd8e5', fontSize: 14, fontWeight: 600, marginTop: 4 }}>
              {pin.issue_title}
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

      {pin.issue_status && (
        <div style={{ marginBottom: 8 }}>
          <span style={{
            background: '#162032', color: '#7a9ab5',
            borderRadius: 4, padding: '2px 8px', fontSize: 11,
          }}>
            {STATUS_LABELS[pin.issue_status] || pin.issue_status}
          </span>
          {pin.issue_priority && (
            <span style={{
              marginLeft: 6,
              color: PRIORITY_COLORS[pin.issue_priority] || '#7a9ab5',
              fontSize: 11,
            }}>
              {PRIORITY_LABELS[pin.issue_priority] || pin.issue_priority}
            </span>
          )}
        </div>
      )}

      {pin.field_issue_id && (
        <a
          href={`/projects/${projectId}/field-issues/${pin.field_issue_id}`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'block', marginBottom: 12,
            color: '#2d72d9', fontSize: 12,
            textDecoration: 'none',
          }}
        >
          Open Issue →
        </a>
      )}

      {!pin.field_issue_id && (
        <div style={{ color: '#4a6480', fontSize: 12, marginBottom: 12 }}>
          No issue linked yet.
        </div>
      )}

      <button
        onClick={() => onDelete(pin.id)}
        style={{
          background: 'transparent', border: '1px solid #7f1d1d',
          color: '#ef4444', borderRadius: 6, padding: '6px 12px',
          fontSize: 12, cursor: 'pointer', width: '100%',
        }}
      >
        Delete Pin
      </button>
    </div>
  );
}
