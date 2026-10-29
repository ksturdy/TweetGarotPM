import React, { useState, useEffect } from 'react';
import type { DrawingIssuePin } from '../../../lib/drawingViewer/types';
import { fieldIssuesApi, type FieldIssue } from '../../../services/fieldIssues';
import { updateIssuePin } from '../../../services/drawingMarkups';

interface Props {
  pin: DrawingIssuePin;
  projectId: number;
  drawingId: number;
  onClose: () => void;
  onDelete: (id: number) => void;
  onUpdate: (pin: DrawingIssuePin) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280', open: '#ef4444',
  in_progress: '#f59e0b', resolved: '#22c55e', closed: '#6b7280',
};
const PRIORITY_COLORS: Record<string, string> = {
  low: '#22c55e', normal: '#3b82f6', high: '#f59e0b', urgent: '#ef4444',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', open: 'Open', in_progress: 'In Progress',
  resolved: 'Resolved', closed: 'Closed',
};
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent',
};

export default function IssuePinPanel({ pin, projectId, drawingId, onClose, onDelete, onUpdate }: Props) {
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fieldIssuesApi.getByProject(projectId).then(r => {
      const data = Array.isArray(r.data) ? r.data : (r.data as any)?.data ?? [];
      setIssues(data);
    }).catch(console.error);
  }, [projectId]);

  const filtered = issues.filter(i => {
    const q = search.toLowerCase();
    return (
      String(i.number).includes(q) ||
      i.title.toLowerCase().includes(q) ||
      (i.trade || '').toLowerCase().includes(q)
    );
  });

  const handleLink = async (issue: FieldIssue) => {
    setSaving(true);
    try {
      await updateIssuePin(drawingId, pin.id, { field_issue_id: issue.id });
      onUpdate({
        ...pin,
        field_issue_id: issue.id,
        issue_title: issue.title,
        issue_status: issue.status,
        issue_priority: issue.priority,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    setSaving(true);
    try {
      await updateIssuePin(drawingId, pin.id, { field_issue_id: null });
      onUpdate({ ...pin, field_issue_id: null, issue_title: undefined, issue_status: undefined, issue_priority: undefined });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ color: '#7a9ab5', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
            Issue Pin #{pin.pin_number}
          </div>
          {pin.issue_title && (
            <div style={{ color: '#cdd8e5', fontSize: 13, fontWeight: 600, marginTop: 4 }}>
              {pin.issue_title}
            </div>
          )}
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#7a9ab5', cursor: 'pointer', fontSize: 18 }}>
          ×
        </button>
      </div>

      {/* Linked issue status/priority */}
      {pin.issue_status && (
        <div style={{ marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{
            background: `${STATUS_COLORS[pin.issue_status] || '#6b7280'}22`,
            color: STATUS_COLORS[pin.issue_status] || '#7a9ab5',
            border: `1px solid ${STATUS_COLORS[pin.issue_status] || '#6b7280'}44`,
            borderRadius: 4, padding: '2px 8px', fontSize: 11,
          }}>
            {STATUS_LABELS[pin.issue_status] || pin.issue_status}
          </span>
          {pin.issue_priority && (
            <span style={{ color: PRIORITY_COLORS[pin.issue_priority] || '#7a9ab5', fontSize: 11 }}>
              {PRIORITY_LABELS[pin.issue_priority] || pin.issue_priority}
            </span>
          )}
        </div>
      )}

      {/* Open link + unlink */}
      {pin.field_issue_id && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
          <a
            href={`/projects/${projectId}/issues/${pin.field_issue_id}`}
            target="_blank" rel="noreferrer"
            style={{ color: '#2d72d9', fontSize: 12, textDecoration: 'none' }}
          >
            Open Issue →
          </a>
          <button
            onClick={handleUnlink}
            disabled={saving}
            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', padding: 0 }}
          >
            Unlink
          </button>
        </div>
      )}

      {!pin.field_issue_id && (
        <div style={{ color: '#4a6480', fontSize: 12, marginBottom: 10 }}>
          No issue linked yet.
        </div>
      )}

      {/* Link / change issue */}
      {!linking ? (
        <button
          onClick={() => setLinking(true)}
          style={{
            width: '100%', background: '#1e4a8a', border: 'none',
            color: '#fff', borderRadius: 6, padding: '7px 0',
            fontSize: 12, cursor: 'pointer', marginBottom: 8,
          }}
        >
          {pin.field_issue_id ? 'Change Issue' : 'Link an Issue'}
        </button>
      ) : (
        <div style={{ marginBottom: 8 }}>
          <input
            autoFocus
            placeholder="Search by number or title…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0f1b2d', border: '1px solid #2d72d9',
              borderRadius: 6, color: '#cdd8e5', fontSize: 12,
              padding: '6px 10px', marginBottom: 6,
            }}
          />
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filtered.length === 0 && (
              <div style={{ color: '#4a6480', fontSize: 11, textAlign: 'center', padding: 8 }}>
                No issues found
              </div>
            )}
            {filtered.map(issue => (
              <div
                key={issue.id}
                onClick={() => handleLink(issue)}
                style={{
                  background: '#162032', border: '1px solid #1e3a5f',
                  borderRadius: 5, padding: '7px 10px', cursor: 'pointer',
                  borderLeft: `3px solid ${STATUS_COLORS[issue.status] || '#6b7280'}`,
                }}
              >
                <div style={{ color: '#cdd8e5', fontSize: 12, fontWeight: 600 }}>
                  #{issue.number} · {issue.title}
                </div>
                <div style={{ color: '#4a6480', fontSize: 11, marginTop: 2 }}>
                  {STATUS_LABELS[issue.status] || issue.status}
                  {issue.trade ? ` · ${issue.trade}` : ''}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setLinking(false); setSearch(''); }}
            style={{ background: 'none', border: 'none', color: '#7a9ab5', fontSize: 11, cursor: 'pointer', marginTop: 4 }}
          >
            Cancel
          </button>
        </div>
      )}

      <button
        onClick={() => onDelete(pin.id)}
        style={{
          width: '100%', background: 'transparent', border: '1px solid #7f1d1d',
          color: '#ef4444', borderRadius: 6, padding: '6px 0',
          fontSize: 12, cursor: 'pointer',
        }}
      >
        Delete Pin
      </button>
    </div>
  );
}
