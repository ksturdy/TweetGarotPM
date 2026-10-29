import React, { useState, useEffect } from 'react';
import type { DrawingSubmittalTag } from '../../../lib/drawingViewer/types';
import { submittalsApi, type Submittal } from '../../../services/submittals';
import { updateSubmittalTag } from '../../../services/drawingMarkups';

interface Props {
  tag: DrawingSubmittalTag;
  projectId: number;
  drawingId: number;
  onClose: () => void;
  onDelete: (id: number) => void;
  onUpdate: (tag: DrawingSubmittalTag) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', under_review: '#3b82f6',
  approved: '#22c55e', approved_as_noted: '#84cc16',
  rejected: '#ef4444', revise_resubmit: '#f97316',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', under_review: 'Under Review',
  approved: 'Approved', approved_as_noted: 'Approved as Noted',
  rejected: 'Rejected', revise_resubmit: 'Revise & Resubmit',
};

export default function SubmittalTagPanel({ tag, projectId, drawingId, onClose, onDelete, onUpdate }: Props) {
  const [submittals, setSubmittals] = useState<Submittal[]>([]);
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    submittalsApi.getByProject(projectId).then(r => {
      const data = Array.isArray(r.data) ? r.data : (r.data as any)?.data ?? [];
      setSubmittals(data);
    }).catch(console.error);
  }, [projectId]);

  const filtered = submittals.filter(s => {
    const q = search.toLowerCase();
    return (
      String(s.number).includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      s.spec_section.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  });

  const handleLink = async (submittal: Submittal) => {
    setSaving(true);
    try {
      const updated = await updateSubmittalTag(drawingId, tag.id, { submittal_id: submittal.id });
      onUpdate({
        ...tag,
        submittal_id: submittal.id,
        submittal_name: submittal.name || submittal.description,
        submittal_status: submittal.status,
        submittal_number: submittal.number,
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
      await updateSubmittalTag(drawingId, tag.id, { submittal_id: null });
      onUpdate({ ...tag, submittal_id: null, submittal_name: undefined, submittal_status: undefined, submittal_number: undefined });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const statusColor = STATUS_COLORS[tag.submittal_status || ''] || '#7a9ab5';

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ color: '#7a9ab5', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
            Submittal Tag
          </div>
        </div>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#7a9ab5', cursor: 'pointer', fontSize: 18 }}>
          ×
        </button>
      </div>

      {/* Linked submittal info */}
      {tag.submittal_id ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: '#7a9ab5', fontSize: 11, marginBottom: 4 }}>
            SUB-{tag.submittal_number}
          </div>
          <div style={{ color: '#cdd8e5', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            {tag.submittal_name || '(No name)'}
          </div>
          <span style={{
            background: `${statusColor}22`, color: statusColor,
            border: `1px solid ${statusColor}44`,
            borderRadius: 4, padding: '2px 8px', fontSize: 11,
          }}>
            {STATUS_LABELS[tag.submittal_status || ''] || tag.submittal_status}
          </span>
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            <a
              href={`/projects/${projectId}/submittals/${tag.submittal_id}`}
              target="_blank" rel="noreferrer"
              style={{ color: '#2d72d9', fontSize: 12, textDecoration: 'none' }}
            >
              Open Submittal →
            </a>
            <button
              onClick={handleUnlink}
              disabled={saving}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              Unlink
            </button>
          </div>
        </div>
      ) : (
        <div style={{ color: '#4a6480', fontSize: 12, marginBottom: 12 }}>
          No submittal linked.
        </div>
      )}

      {/* Link / change submittal */}
      {!linking ? (
        <button
          onClick={() => setLinking(true)}
          style={{
            width: '100%', background: '#1e4a8a', border: 'none',
            color: '#fff', borderRadius: 6, padding: '7px 0',
            fontSize: 12, cursor: 'pointer', marginBottom: 8,
          }}
        >
          {tag.submittal_id ? 'Change Submittal' : 'Link a Submittal'}
        </button>
      ) : (
        <div style={{ marginBottom: 8 }}>
          <input
            autoFocus
            placeholder="Search by number, name, spec…"
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
                No submittals found
              </div>
            )}
            {filtered.map(s => (
              <div
                key={s.id}
                onClick={() => handleLink(s)}
                style={{
                  background: '#162032', border: '1px solid #1e3a5f',
                  borderRadius: 5, padding: '7px 10px', cursor: 'pointer',
                  borderLeft: `3px solid ${STATUS_COLORS[s.status] || '#7a9ab5'}`,
                }}
              >
                <div style={{ color: '#cdd8e5', fontSize: 12, fontWeight: 600 }}>
                  SUB-{s.number} · {s.name || s.description.slice(0, 40)}
                </div>
                <div style={{ color: '#4a6480', fontSize: 11, marginTop: 2 }}>
                  {s.spec_section} · {STATUS_LABELS[s.status] || s.status}
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
        onClick={() => onDelete(tag.id)}
        style={{
          width: '100%', background: 'transparent', border: '1px solid #7f1d1d',
          color: '#ef4444', borderRadius: 6, padding: '6px 0',
          fontSize: 12, cursor: 'pointer',
        }}
      >
        Delete Tag
      </button>
    </div>
  );
}
