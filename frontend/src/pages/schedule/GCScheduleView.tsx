// @refresh reset
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  gcSchedulesApi,
  GCScheduleVersion,
  GCScheduleActivity,
  GCScheduleTag,
  GCScheduleTagGroup,
  ActivityFilters,
} from '../../services/gcSchedules';
import { projectsApi } from '../../services/projects';
import { phaseScheduleApi, PhaseScheduleItem } from '../../services/phaseSchedule';
import { phaseScheduleLinksApi } from '../../services/phaseScheduleLinks';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { exportGcScheduleDiffPdf } from '../../utils/gcScheduleDiffPdf';
import { exportGcScheduleDiffExcel } from '../../utils/gcScheduleDiffExcel';
import '../../styles/SalesPipeline.css';

const fmtDate = (s: string | null): string => {
  if (!s) return '-';
  const isoDate = s.length >= 10 ? s.slice(0, 10) : s;
  const d = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return s;
  return format(d, 'MMM d, yyyy');
};

const daysBetween = (a: string | null, b: string | null): number | null => {
  if (!a || !b) return null;
  const da = new Date(a.slice(0, 10) + 'T00:00:00').getTime();
  const db = new Date(b.slice(0, 10) + 'T00:00:00').getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((db - da) / 86400000);
};

const renderChangeLines = (diffs: Record<string, any>): React.ReactNode => {
  const order = ['start', 'finish', 'duration', 'percent', 'name'];
  const keys = Object.keys(diffs).sort((a, b) => {
    const ai = order.indexOf(a); const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const days = (n: number) => `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'}`;

  const row = (label: string, verdict: string, color: string, context: React.ReactNode) => (
    <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', columnGap: 10, alignItems: 'baseline', padding: '1px 0' }}>
      <strong style={{ color: '#374151' }}>{label}</strong>
      <span>
        <span style={{ color, fontWeight: 600 }}>{verdict}</span>
        <span style={{ color: '#9ca3af', marginLeft: 8 }}>{context}</span>
      </span>
    </div>
  );

  const dateRow = (label: string, v: any) => {
    const d: number | null = v.deltaDays;
    let verdict = '—'; let color = '#6b7280';
    if (d != null) {
      if (d > 0) { verdict = `Delayed by ${days(d)}`; color = '#dc2626'; }
      else if (d < 0) { verdict = `Earlier by ${days(d)}`; color = '#16a34a'; }
      else verdict = 'No change';
    } else if (!v.from && v.to) { verdict = 'Date set'; color = '#16a34a'; }
    else if (v.from && !v.to) { verdict = 'Date cleared'; color = '#dc2626'; }
    return row(label, verdict, color, <>({fmtDate(v.from)} → {fmtDate(v.to)})</>);
  };

  const durRow = (v: any) => {
    const d: number | null = v.deltaDays;
    let verdict = '—'; let color = '#6b7280';
    if (d != null) {
      if (d > 0) { verdict = `Increased by ${days(d)}`; color = '#16a34a'; }
      else if (d < 0) { verdict = `Decreased by ${days(d)}`; color = '#dc2626'; }
      else verdict = 'No change';
    } else if (v.from == null && v.to != null) verdict = 'Set';
    else if (v.from != null && v.to == null) verdict = 'Cleared';
    return row('Duration', verdict, color, <>({v.from ?? '-'} → {v.to ?? '-'} days)</>);
  };

  const pctRow = (v: any) => {
    const d: number | null = v.deltaPoints;
    let verdict = '—'; let color = '#6b7280';
    if (d != null) {
      if (d > 0) { verdict = `Increased by ${Math.abs(d)} pts`; color = '#16a34a'; }
      else if (d < 0) { verdict = `Decreased by ${Math.abs(d)} pts`; color = '#dc2626'; }
      else verdict = 'No change';
    }
    return row('% Complete', verdict, color, <>({v.from ?? '-'}% → {v.to ?? '-'}%)</>);
  };

  return keys.map((k) => {
    const v = diffs[k];
    if (k === 'start') return dateRow('Start Date', v);
    if (k === 'finish') return dateRow('Finish Date', v);
    if (k === 'duration') return durRow(v);
    if (k === 'percent') return pctRow(v);
    if (k === 'name') return row('Name', 'Renamed', '#6b7280', <>("{String(v.from ?? '')}" → "{String(v.to ?? '')}")</>);
    return null;
  });
};

const fmtTimestamp = (s: string | null | undefined): string => {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return format(d, 'MMM d, yyyy h:mm a');
};

const formatLabel: Record<string, string> = {
  xlsx: 'Excel',
  csv: 'CSV',
  xer: 'Primavera XER',
  pdf: 'PDF',
  mspxml: 'MS Project XML',
};

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'white' };
const tdStyle: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' };

// Colored pill for a single tag
const TagChip: React.FC<{ tag: { id: number; name: string; color: string } }> = ({ tag }) => (
  <span style={{
    background: tag.color + '22',
    color: tag.color,
    border: `1px solid ${tag.color}55`,
    borderRadius: 3,
    padding: '1px 6px',
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }}>
    {tag.name}
  </span>
);

const TagChips: React.FC<{ tags: Array<{ id: number; name: string; color: string }> | undefined }> = ({ tags }) => {
  if (!tags || tags.length === 0) return <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {tags.map((t) => <TagChip key={t.id} tag={t} />)}
    </div>
  );
};

const TAG_COLORS = [
  '#1e40af', '#0d9488', '#16a34a', '#7c3aed',
  '#db2777', '#ea580c', '#dc2626', '#d97706',
  '#0891b2', '#6b7280',
];

const MAX_TAG_GROUPS = 3;

// Shared style for the filter pill buttons (trades + tags)
const filterBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 8px', fontSize: 13,
  border: '1px solid #d1d5db', borderRadius: 4,
  background: active ? '#eff6ff' : 'white',
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
  whiteSpace: 'nowrap',
});

// Shared dropdown panel style
const filterDropdownStyle: React.CSSProperties = {
  position: 'fixed', zIndex: 9999,
  background: 'white', border: '1px solid #e5e7eb', borderRadius: 6,
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '6px 0',
  minWidth: 180,
};

const TRADE_OPTIONS = [
  { value: '', label: 'All trades' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'sprinkler', label: 'Sprinkler' },
  { value: 'controls', label: 'Controls' },
];

// Single-select trade filter styled to match TagMultiFilter
const TradeSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = TRADE_OPTIONS.find((o) => o.value === value)?.label || 'All trades';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        style={filterBtnStyle(!!value)}
        onClick={() => {
          setRect(btnRef.current!.getBoundingClientRect());
          setOpen((v) => !v);
        }}
      >
        {value && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#2563eb' }} />}
        {label} ▾
      </button>
      {open && rect && createPortal(
        <div ref={dropRef} style={{ ...filterDropdownStyle, top: rect.bottom + 2, left: rect.left }}>
          {TRADE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 12px', border: 'none', cursor: 'pointer', fontSize: 13,
                background: value === opt.value ? '#eff6ff' : 'transparent',
                color: '#111827',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

const TagMultiFilter: React.FC<{
  tags: GCScheduleTag[];
  tagGroups: GCScheduleTagGroup[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}> = ({ tags, tagGroups, selectedIds, onChange }) => {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = selectedIds.length === 0
    ? 'All tags'
    : selectedIds.length === 1
      ? tags.find((t) => t.id === selectedIds[0])?.name || '1 tag'
      : `${selectedIds.length} tags`;

  const tagRow = (tag: GCScheduleTag) => (
    <label key={tag.id} style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '5px 12px',
      cursor: 'pointer', fontSize: 13,
      background: selectedIds.includes(tag.id) ? '#eff6ff' : 'transparent',
    }}>
      <input
        type="checkbox"
        checked={selectedIds.includes(tag.id)}
        onChange={(e) => {
          if (e.target.checked) onChange([...selectedIds, tag.id]);
          else onChange(selectedIds.filter((id) => id !== tag.id));
        }}
      />
      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
      {tag.name}
    </label>
  );

  const ungrouped = tags.filter((t) => !t.group_id);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        style={filterBtnStyle(selectedIds.length > 0)}
        onClick={() => {
          setRect(btnRef.current!.getBoundingClientRect());
          setOpen((v) => !v);
        }}
      >
        {selectedIds.length > 0 && (
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#2563eb' }} />
        )}
        {label} ▾
      </button>
      {open && rect && createPortal(
        <div ref={dropRef} style={{ ...filterDropdownStyle, top: rect.bottom + 2, left: rect.left, maxHeight: 320, overflowY: 'auto' }}>
          {tags.length === 0 && (
            <div style={{ fontSize: 12, color: '#6b7280', padding: '4px 12px' }}>No tags created yet</div>
          )}
          {tagGroups.map((g) => {
            const groupTags = tags.filter((t) => t.group_id === g.id);
            if (groupTags.length === 0) return null;
            return (
              <div key={g.id}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', padding: '6px 12px 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {g.name}
                </div>
                {groupTags.map(tagRow)}
              </div>
            );
          })}
          {ungrouped.length > 0 && (
            <div>
              {tagGroups.length > 0 && (
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', padding: '6px 12px 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Other
                </div>
              )}
              {ungrouped.map(tagRow)}
            </div>
          )}
          {selectedIds.length > 0 && (
            <>
              <div style={{ margin: '4px 0', borderTop: '1px solid #f3f4f6' }} />
              <button
                type="button"
                onClick={() => { onChange([]); setOpen(false); }}
                style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 12px' }}
              >
                Clear filter
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

// Inline-edit form for a single tag (used inside both group sections and ungrouped)
const TagEditForm: React.FC<{
  tag: GCScheduleTag;
  groups: GCScheduleTagGroup[];
  onSave: (name: string, color: string, groupId: number | null) => void;
  onDelete: () => void;
  onCancel: () => void;
  saving: boolean;
}> = ({ tag, groups, onSave, onDelete, onCancel, saving }) => {
  const [editName, setEditName] = useState(tag.name);
  const [editColor, setEditColor] = useState(tag.color);
  const [editGroupId, setEditGroupId] = useState<number | null>(tag.group_id ?? null);
  return (
    <div style={{ padding: '8px 8px 6px', background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', marginBottom: 4 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && editName.trim()) onSave(editName.trim(), editColor, editGroupId); if (e.key === 'Escape') onCancel(); }}
          maxLength={100}
          autoFocus
          style={{ flex: 1, padding: '4px 7px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 13 }}
        />
        <button type="button" disabled={!editName.trim() || saving} onClick={() => onSave(editName.trim(), editColor, editGroupId)} className="btn btn-sm btn-primary">
          {saving ? '...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-sm">Cancel</button>
        <button type="button" onClick={onDelete} title="Delete tag"
          style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 4, cursor: 'pointer', color: '#dc2626', fontSize: 12, padding: '3px 7px' }}>
          Delete
        </button>
      </div>
      {groups.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>Group</label>
          <select
            value={editGroupId ?? ''}
            onChange={(e) => setEditGroupId(e.target.value === '' ? null : Number(e.target.value))}
            style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 5, width: '100%' }}
          >
            <option value="">No group (Ungrouped)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {TAG_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setEditColor(c)} style={{
            width: 18, height: 18, borderRadius: 3, background: c, padding: 0,
            border: editColor === c ? '3px solid #111827' : '2px solid transparent', cursor: 'pointer',
          }} />
        ))}
        <span style={{ fontSize: 11, color: '#6b7280', alignSelf: 'center', marginLeft: 2 }}>
          <TagChip tag={{ id: 0, name: editName || tag.name, color: editColor }} />
        </span>
      </div>
    </div>
  );
};

// Add-tag mini-form inside a group (or ungrouped section)
const AddTagForm: React.FC<{
  onAdd: (name: string, color: string) => void;
  adding: boolean;
}> = ({ onAdd, adding }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]);
  return (
    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e5e7eb' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Tag name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { onAdd(name.trim(), color); setName(''); } }}
          maxLength={100}
          style={{ flex: 1, padding: '4px 7px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 12 }}
        />
        <button type="button" disabled={!name.trim() || adding} onClick={() => { onAdd(name.trim(), color); setName(''); }} className="btn btn-sm btn-primary" style={{ fontSize: 12 }}>
          Add
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
        {TAG_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} style={{
            width: 16, height: 16, borderRadius: 3, background: c, padding: 0,
            border: color === c ? '3px solid #111827' : '2px solid transparent', cursor: 'pointer',
          }} />
        ))}
        {name.trim() && <span style={{ marginLeft: 2, alignSelf: 'center' }}><TagChip tag={{ id: 0, name: name.trim(), color }} /></span>}
      </div>
    </div>
  );
};

// Tag manager modal
const TagManagerModal: React.FC<{
  projectId: number;
  onClose: () => void;
}> = ({ projectId, onClose }) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  const tagsQuery = useQuery({
    queryKey: ['gc-schedule-tags', projectId],
    queryFn: () => gcSchedulesApi.listTags(projectId).then((r) => r.data),
  });
  const groupsQuery = useQuery({
    queryKey: ['gc-schedule-tag-groups', projectId],
    queryFn: () => gcSchedulesApi.listTagGroups(projectId).then((r) => r.data),
  });
  const tags = tagsQuery.data || [];
  const groups = groupsQuery.data || [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['gc-schedule-tags', projectId] });
    queryClient.invalidateQueries({ queryKey: ['gc-schedule-tag-groups', projectId] });
    queryClient.invalidateQueries({ queryKey: ['gc-schedule-activities'] });
  };

  const createTagMut = useMutation({
    mutationFn: (d: { name: string; color: string; groupId?: number | null }) =>
      gcSchedulesApi.createTag(projectId, d),
    onSuccess: () => { setError(null); invalidate(); },
    onError: (e: any) => setError(e?.response?.data?.message || e?.message || 'Failed to create tag'),
  });

  const updateTagMut = useMutation({
    mutationFn: ({ tagId, name, color, groupId }: { tagId: number; name: string; color: string; groupId?: number | null }) =>
      gcSchedulesApi.updateTag(tagId, { name, color, groupId }),
    onSuccess: () => { setEditingTagId(null); setError(null); invalidate(); },
    onError: (e: any) => setError(e?.response?.data?.message || e?.message || 'Failed to update tag'),
  });

  const deleteTagMut = useMutation({
    mutationFn: (tagId: number) => gcSchedulesApi.deleteTag(tagId),
    onSuccess: () => invalidate(),
  });

  const createGroupMut = useMutation({
    mutationFn: (name: string) => gcSchedulesApi.createTagGroup(projectId, { name }),
    onSuccess: () => { setError(null); invalidate(); },
    onError: (e: any) => setError(e?.response?.data?.message || e?.message || 'Failed to create group'),
  });

  const updateGroupMut = useMutation({
    mutationFn: ({ groupId, name }: { groupId: number; name: string }) =>
      gcSchedulesApi.updateTagGroup(groupId, { name }),
    onSuccess: () => { setEditingGroupId(null); setError(null); invalidate(); },
    onError: (e: any) => setError(e?.response?.data?.message || e?.message || 'Failed to update group'),
  });

  const deleteGroupMut = useMutation({
    mutationFn: (groupId: number) => gcSchedulesApi.deleteTagGroup(groupId),
    onSuccess: () => invalidate(),
  });

  const renderTag = (tag: GCScheduleTag) => {
    if (editingTagId === tag.id) {
      return (
        <TagEditForm
          key={tag.id}
          tag={tag}
          groups={groups}
          onSave={(name, color, groupId) => updateTagMut.mutate({ tagId: tag.id, name, color, groupId })}
          onDelete={() => { if (window.confirm(`Delete tag "${tag.name}"?`)) { deleteTagMut.mutate(tag.id); setEditingTagId(null); } }}
          onCancel={() => setEditingTagId(null)}
          saving={updateTagMut.isPending}
        />
      );
    }
    return (
      <div key={tag.id} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px', marginBottom: 3,
        background: '#f9fafb', borderRadius: 5, border: '1px solid #e5e7eb',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: tag.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>{tag.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button type="button" onClick={() => { setEditingTagId(tag.id); setError(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, padding: '0 5px' }} title="Edit">&#9998;</button>
          <button type="button" onClick={() => { if (window.confirm(`Delete tag "${tag.name}"?`)) deleteTagMut.mutate(tag.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: '0 3px' }} title="Delete">&times;</button>
        </div>
      </div>
    );
  };

  const ungroupedTags = tags.filter((t) => !t.group_id);

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 12, width: 460, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>Manage Tags</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Organize tags into groups (up to {MAX_TAG_GROUPS}). Tags survive schedule re-uploads.
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {(tagsQuery.isLoading || groupsQuery.isLoading) && <div style={{ color: '#6b7280', fontSize: 13 }}>Loading...</div>}
          {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8, background: '#fef2f2', padding: '4px 8px', borderRadius: 4 }}>{error}</div>}

          {/* Existing groups */}
          {groups.map((group) => {
            const groupTags = tags.filter((t) => t.group_id === group.id);
            return (
              <div key={group.id} style={{ marginBottom: 14, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                  {editingGroupId === group.id ? (
                    <>
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && editGroupName.trim()) updateGroupMut.mutate({ groupId: group.id, name: editGroupName.trim() }); if (e.key === 'Escape') setEditingGroupId(null); }}
                        autoFocus
                        maxLength={100}
                        style={{ flex: 1, padding: '3px 7px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: 13, fontWeight: 600 }}
                      />
                      <button type="button" disabled={!editGroupName.trim() || updateGroupMut.isPending} onClick={() => updateGroupMut.mutate({ groupId: group.id, name: editGroupName.trim() })} className="btn btn-sm btn-primary" style={{ fontSize: 12 }}>Save</button>
                      <button type="button" onClick={() => setEditingGroupId(null)} className="btn btn-sm" style={{ fontSize: 12 }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', flex: 1 }}>{group.name}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af', marginRight: 4 }}>{groupTags.length} tag{groupTags.length !== 1 ? 's' : ''}</span>
                      <button type="button" onClick={() => { setEditingGroupId(group.id); setEditGroupName(group.name); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, padding: '0 4px' }} title="Rename group">&#9998;</button>
                      <button type="button" onClick={() => {
                        const msg = groupTags.length > 0
                          ? `Delete group "${group.name}"? Its ${groupTags.length} tag(s) will become ungrouped.`
                          : `Delete group "${group.name}"?`;
                        if (window.confirm(msg)) deleteGroupMut.mutate(group.id);
                      }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16, lineHeight: 1, padding: '0 2px' }} title="Delete group">&times;</button>
                    </>
                  )}
                </div>
                <div style={{ padding: '8px 10px' }}>
                  {groupTags.length === 0 && !tagsQuery.isLoading && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>No tags yet.</div>
                  )}
                  {groupTags.map(renderTag)}
                  <AddTagForm onAdd={(name, color) => createTagMut.mutate({ name, color, groupId: group.id })} adding={createTagMut.isPending} />
                </div>
              </div>
            );
          })}

          {/* Ungrouped tags */}
          <div style={{ marginBottom: 14, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Ungrouped</span>
              <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{ungroupedTags.length} tag{ungroupedTags.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ padding: '8px 10px' }}>
              {ungroupedTags.length === 0 && !tagsQuery.isLoading && (
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>No ungrouped tags.</div>
              )}
              {ungroupedTags.map(renderTag)}
              <AddTagForm onAdd={(name, color) => createTagMut.mutate({ name, color, groupId: null })} adding={createTagMut.isPending} />
            </div>
          </div>

          {/* Add new group */}
          {groups.length < MAX_TAG_GROUPS ? (
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Add Tag Group ({groups.length}/{MAX_TAG_GROUPS})
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="Group name (e.g. Area, Floor)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newGroupName.trim()) { createGroupMut.mutate(newGroupName.trim()); setNewGroupName(''); } }}
                  maxLength={100}
                  style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                />
                <button
                  type="button"
                  disabled={!newGroupName.trim() || createGroupMut.isPending}
                  onClick={() => { createGroupMut.mutate(newGroupName.trim()); setNewGroupName(''); }}
                  className="btn btn-sm btn-primary"
                >
                  Create Group
                </button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', paddingTop: 8 }}>
              Maximum {MAX_TAG_GROUPS} groups reached.
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', background: '#f9fafb' }}>
          <button className="btn btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Tag assign modal — shown when activities are selected and user clicks "Tag…"
const TagAssignModal: React.FC<{
  projectId: number;
  selectedActivities: GCScheduleActivity[];
  onClose: () => void;
  onDone: () => void;
}> = ({ projectId, selectedActivities, onClose, onDone }) => {
  const queryClient = useQueryClient();
  const tagsQuery = useQuery({
    queryKey: ['gc-schedule-tags', projectId],
    queryFn: () => gcSchedulesApi.listTags(projectId).then((r) => r.data),
  });
  const groupsQuery = useQuery({
    queryKey: ['gc-schedule-tag-groups', projectId],
    queryFn: () => gcSchedulesApi.listTagGroups(projectId).then((r) => r.data),
  });
  const tags = tagsQuery.data || [];
  const tagGroups = groupsQuery.data || [];

  // Compute initial state: for each tag, are all / some / none of the selected activities tagged?
  const tagState = useMemo<Map<number, 'all' | 'some' | 'none'>>(() => {
    const m = new Map<number, 'all' | 'some' | 'none'>();
    for (const tag of tags) {
      const count = selectedActivities.filter((a) =>
        a.activity_id && a.tags?.some((t) => t.id === tag.id)
      ).length;
      const eligible = selectedActivities.filter((a) => !!a.activity_id).length;
      m.set(tag.id, count === 0 ? 'none' : count === eligible ? 'all' : 'some');
    }
    return m;
  }, [tags, selectedActivities]);

  // Local checked state: starts from tagState
  const [checked, setChecked] = useState<Map<number, boolean>>(() => {
    const m = new Map<number, boolean>();
    for (const tag of tags) {
      m.set(tag.id, tagState.get(tag.id) !== 'none');
    }
    return m;
  });

  // Sync checked state when tagState changes (tags loaded async)
  useEffect(() => {
    setChecked((prev) => {
      const m = new Map(prev);
      for (const tag of tags) {
        if (!m.has(tag.id)) m.set(tag.id, tagState.get(tag.id) !== 'none');
      }
      return m;
    });
  }, [tags, tagState]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleActivityIds = selectedActivities.map((a) => a.activity_id).filter(Boolean) as string[];

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const toAssign = tags.filter((t) => checked.get(t.id)).map((t) => t.id);
      const toUnassign = tags.filter((t) => !checked.get(t.id)).map((t) => t.id);

      const ops: Promise<any>[] = [];
      if (toAssign.length) {
        ops.push(gcSchedulesApi.assignTags({ tagIds: toAssign, activityIds: eligibleActivityIds, projectId }));
      }
      if (toUnassign.length) {
        ops.push(gcSchedulesApi.unassignTags({ tagIds: toUnassign, activityIds: eligibleActivityIds }));
      }
      await Promise.all(ops);
      queryClient.invalidateQueries({ queryKey: ['gc-schedule-activities'] });
      queryClient.invalidateQueries({ queryKey: ['gc-schedule-diff'] });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to save tags');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 12, width: 360, maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Assign Tags</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {eligibleActivityIds.length} activit{eligibleActivityIds.length === 1 ? 'y' : 'ies'} selected
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {(tagsQuery.isLoading || groupsQuery.isLoading) && <div style={{ color: '#6b7280', fontSize: 13, padding: '8px 20px' }}>Loading...</div>}
          {!tagsQuery.isLoading && tags.length === 0 && (
            <div style={{ color: '#9ca3af', fontSize: 13, padding: '8px 20px' }}>
              No tags yet. Use "Manage Tags" to create some first.
            </div>
          )}
          {(() => {
            const tagRow = (tag: GCScheduleTag) => {
              const state = tagState.get(tag.id) || 'none';
              const isChecked = !!checked.get(tag.id);
              return (
                <label key={tag.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 20px',
                  cursor: 'pointer', background: isChecked ? '#f0fdf4' : 'transparent',
                }}>
                  <input type="checkbox" checked={isChecked} onChange={(e) => setChecked((prev) => new Map(prev).set(tag.id, e.target.checked))} />
                  <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: tag.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{tag.name}</span>
                  {state === 'some' && <span style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>partial</span>}
                </label>
              );
            };
            const ungrouped = tags.filter((t) => !t.group_id);
            return (
              <>
                {tagGroups.map((g) => {
                  const groupTags = tags.filter((t) => t.group_id === g.id);
                  if (groupTags.length === 0) return null;
                  return (
                    <div key={g.id}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', padding: '6px 20px 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.name}</div>
                      {groupTags.map(tagRow)}
                    </div>
                  );
                })}
                {ungrouped.length > 0 && (
                  <div>
                    {tagGroups.length > 0 && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', padding: '6px 20px 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Other</div>
                    )}
                    {ungrouped.map(tagRow)}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {error && <div style={{ padding: '6px 20px', color: '#b91c1c', fontSize: 12, background: '#fef2f2' }}>{error}</div>}

        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f9fafb' }}>
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-sm btn-primary"
            disabled={busy || eligibleActivityIds.length === 0 || tags.length === 0}
            onClick={submit}
          >
            {busy ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

interface ColDef {
  key: string;
  label: string;
  sortable: boolean;
  groupId?: number;
  isTag?: boolean;
}

const STANDARD_COL_DEFS: ColDef[] = [
  { key: 'activity_id', label: 'Activity ID', sortable: true },
  { key: 'activity_name', label: 'Activity Name', sortable: true },
  { key: 'start_date', label: 'Start', sortable: true },
  { key: 'finish_date', label: 'Finish', sortable: true },
  { key: 'duration_days', label: 'Dur', sortable: true },
  { key: 'percent_complete', label: '% Comp', sortable: true },
  { key: 'responsible', label: 'Responsible', sortable: true },
  { key: 'tags_ungrouped', label: 'Tags', sortable: false, isTag: true },
];

const COL_WIDTHS_KEY = 'gc-schedule-col-widths-v2';
const VISIBLE_COLS_KEY = 'gc-schedule-visible-cols-v1';
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  activity_id: 100,
  activity_name: 300,
  start_date: 110,
  finish_date: 110,
  duration_days: 60,
  percent_complete: 70,
  responsible: 130,
  tags_ungrouped: 180,
};
const DEFAULT_TAG_COL_WIDTH = 150;

const SortIcon: React.FC<{ col: string; sortKey: string | null; sortDir: 'asc' | 'desc' }> = ({ col, sortKey, sortDir }) => (
  <span style={{ marginLeft: 4, fontSize: 10, color: sortKey === col ? '#2563eb' : '#d1d5db' }}>
    {sortKey === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
  </span>
);

const ResizeHandle: React.FC<{ onMouseDown: (e: React.MouseEvent) => void }> = ({ onMouseDown }) => (
  <div
    onMouseDown={onMouseDown}
    style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 5,
      cursor: 'col-resize', userSelect: 'none', zIndex: 1,
    }}
  />
);

// Right-click column chooser panel
const ColumnChooser: React.FC<{
  pos: { x: number; y: number };
  allCols: ColDef[];
  visibleCols: Set<string>;
  onToggle: (key: string) => void;
  onClose: () => void;
}> = ({ pos, allCols, visibleCols, onToggle, onClose }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const standardCols = allCols.filter((c) => !c.groupId && !c.isTag);
  const tagGroupCols = allCols.filter((c) => !!c.groupId);
  const unGroupedCol = allCols.find((c) => c.isTag && !c.groupId);

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed', zIndex: 9999,
        top: pos.y, left: pos.x,
        background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: '10px 0', minWidth: 200,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', padding: '2px 14px 6px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Columns
      </div>
      {standardCols.map((col) => (
        <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 13 }}>
          <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => onToggle(col.key)} />
          {col.label}
        </label>
      ))}
      {(tagGroupCols.length > 0 || unGroupedCol) && (
        <>
          <div style={{ margin: '6px 0', borderTop: '1px solid #f3f4f6' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', padding: '2px 14px 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Tag Columns
          </div>
          {tagGroupCols.map((col) => (
            <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => onToggle(col.key)} />
              {col.label}
            </label>
          ))}
          {unGroupedCol && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={visibleCols.has(unGroupedCol.key)} onChange={() => onToggle(unGroupedCol.key)} />
              {unGroupedCol.label} (ungrouped)
            </label>
          )}
        </>
      )}
    </div>,
    document.body
  );
};

const GCScheduleView: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const queryClient = useQueryClient();
  const { user, tenant } = useAuth();
  const logoUrl = tenant?.settings?.branding?.logo_url ? '/api/tenant/logo' : undefined;

  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleCollapsed = (displayOrder: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(displayOrder)) next.delete(displayOrder);
      else next.add(displayOrder);
      return next;
    });
  };
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [filters, setFilters] = useState<ActivityFilters>({ mechanicalOnly: false, hideSummary: false });
  const [tagFilterIds, setTagFilterIds] = useState<number[]>([]);
  const [searchInput, setSearchInput] = useState('');

  // Column widths — persisted to localStorage
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(COL_WIDTHS_KEY);
      return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : { ...DEFAULT_COL_WIDTHS };
    } catch { return { ...DEFAULT_COL_WIDTHS }; }
  });
  useEffect(() => {
    localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(colWidths));
  }, [colWidths]);

  // Column resize drag
  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);
  const startResize = (e: React.MouseEvent, key: string) => {
    e.preventDefault(); e.stopPropagation();
    setResizing({ key, startX: e.clientX, startWidth: colWidths[key] ?? DEFAULT_COL_WIDTHS[key] ?? DEFAULT_TAG_COL_WIDTH });
  };
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const newWidth = Math.max(40, resizing.startWidth + e.clientX - resizing.startX);
      setColWidths((prev) => ({ ...prev, [resizing.key]: newWidth }));
    };
    const onUp = () => setResizing(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [resizing]);

  // Column sort — active sort switches to flat (no-tree) view
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortKey(null); }
    } else {
      setSortKey(key); setSortDir('asc');
    }
  };

  // Debounce search input → filters.search so the table updates as you type
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput || undefined }));
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffA, setDiffA] = useState<number | null>(null);
  const [diffB, setDiffB] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [linkPhaseOpen, setLinkPhaseOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [tagAssignOpen, setTagAssignOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => projectsApi.getById(pid).then((r) => r.data),
  });

  const versionsQuery = useQuery({
    queryKey: ['gc-schedule-versions', pid],
    queryFn: () => gcSchedulesApi.listVersions(pid).then((r) => r.data),
  });

  const tagsQuery = useQuery({
    queryKey: ['gc-schedule-tags', pid],
    queryFn: () => gcSchedulesApi.listTags(pid).then((r) => r.data),
  });
  const tagGroupsQuery = useQuery({
    queryKey: ['gc-schedule-tag-groups', pid],
    queryFn: () => gcSchedulesApi.listTagGroups(pid).then((r) => r.data),
  });
  const projectTags = tagsQuery.data || [];
  const projectTagGroups = tagGroupsQuery.data || [];

  // Build all available column defs (standard + one per tag group)
  const allColDefs = useMemo<ColDef[]>(() => [
    ...STANDARD_COL_DEFS,
    ...projectTagGroups.map((g) => ({
      key: `group_${g.id}`,
      label: g.name,
      sortable: false,
      groupId: g.id,
    })),
  ], [projectTagGroups]);

  // Visible columns — persisted to localStorage; new tag-group cols default to visible
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(VISIBLE_COLS_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch { /* ignore */ }
    return new Set(STANDARD_COL_DEFS.map((c) => c.key));
  });

  useEffect(() => {
    setVisibleCols((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const g of projectTagGroups) {
        const k = `group_${g.id}`;
        if (!next.has(k)) { next.add(k); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [projectTagGroups]);

  useEffect(() => {
    localStorage.setItem(VISIBLE_COLS_KEY, JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  const visibleColDefs = useMemo(() => allColDefs.filter((c) => visibleCols.has(c.key)), [allColDefs, visibleCols]);

  const toggleCol = (key: string) => setVisibleCols((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const [colChooserPos, setColChooserPos] = useState<{ x: number; y: number } | null>(null);

  const versions = versionsQuery.data || [];

  const effectiveVersionId = useMemo(() => {
    if (selectedVersionId) return selectedVersionId;
    if (versions.length) return versions[0].id;
    return null;
  }, [selectedVersionId, versions]);

  // Combine tag filter IDs into the filters object sent to the query
  const effectiveFilters = useMemo<ActivityFilters>(
    () => ({ ...filters, tagIds: tagFilterIds.length ? tagFilterIds : undefined }),
    [filters, tagFilterIds]
  );

  const activitiesQuery = useQuery({
    queryKey: ['gc-schedule-activities', effectiveVersionId, effectiveFilters],
    queryFn: () =>
      gcSchedulesApi.getActivities(effectiveVersionId!, effectiveFilters).then((r) => r.data),
    enabled: !!effectiveVersionId,
  });

  const diffQuery = useQuery({
    queryKey: ['gc-schedule-diff', pid, diffA, diffB],
    queryFn: () => gcSchedulesApi.diff(pid, diffA!, diffB!).then((r) => r.data),
    enabled: diffOpen && !!diffA && !!diffB && diffA !== diffB,
  });

  const toggleMech = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) =>
      gcSchedulesApi.toggleMechanical(id, on),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gc-schedule-activities'] });
    },
  });

  const bulkMech = useMutation({
    mutationFn: ({ ids, on }: { ids: number[]; on: boolean }) =>
      gcSchedulesApi.bulkSetMechanical(ids, on),
    onSuccess: () => {
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['gc-schedule-activities'] });
    },
  });

  const deleteVersion = useMutation({
    mutationFn: (id: number) => gcSchedulesApi.deleteVersion(id),
    onSuccess: () => {
      setSelectedVersionId(null);
      queryClient.invalidateQueries({ queryKey: ['gc-schedule-versions', pid] });
    },
  });

  const activities = activitiesQuery.data?.activities || [];
  const currentVersion = activitiesQuery.data?.version;

  const stats = useMemo(() => {
    const total = activities.length;
    const mech = activities.filter((a) => a.is_mechanical).length;
    const milestones = activities.filter((a) => a.is_milestone).length;
    const earliest = activities.reduce<string | null>((min, a) => {
      if (!a.start_date) return min;
      if (!min || a.start_date < min) return a.start_date;
      return min;
    }, null);
    const latest = activities.reduce<string | null>((max, a) => {
      if (!a.finish_date) return max;
      if (!max || a.finish_date > max) return a.finish_date;
      return max;
    }, null);
    return { total, mech, milestones, earliest, latest };
  }, [activities]);

  return (
    <div>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link
              to={`/projects/${pid}`}
              style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}
            >
              &larr; Back to Project
            </Link>
            <h1>📋 GC Schedule</h1>
            <div className="sales-subtitle">{project?.name || 'Project'} - GC Schedule Versions</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <Link to={`/projects/${pid}/schedule`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            Internal Schedule
          </Link>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setTagManagerOpen(true)}
            title="Create and manage custom tags for this project's schedule activities"
          >
            Manage Tags
          </button>
          <button
            className={diffOpen ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            disabled={versions.length < 2}
            onClick={() => {
              setDiffOpen((v) => !v);
              if (!diffOpen && versions.length >= 2) {
                setDiffA(versions[1].id);
                setDiffB(versions[0].id);
              }
            }}
          >
            {diffOpen ? 'Exit Comparison' : 'Compare Versions'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setUploadOpen((v) => !v)}>
            {uploadOpen ? 'Cancel Upload' : 'Upload Schedule'}
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Parser warnings</h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {warnings.map((w, i) => <li key={i} style={{ fontSize: '0.875rem' }}>{w}</li>)}
          </ul>
          <button className="btn btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setWarnings([])}>Dismiss</button>
        </div>
      )}

      {uploadOpen && (
        <UploadCard
          projectId={pid}
          onUploaded={(warns) => {
            setWarnings(warns || []);
            setUploadOpen(false);
            queryClient.invalidateQueries({ queryKey: ['gc-schedule-versions', pid] });
          }}
        />
      )}

      {versions.length > 0 ? (
        <div className="card" style={{ marginBottom: '0.75rem', padding: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 2 }}>
                Version
              </label>
              <select
                value={effectiveVersionId || ''}
                onChange={(e) => setSelectedVersionId(Number(e.target.value))}
                style={{ minWidth: 280, padding: '4px 6px', fontSize: 13 }}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {versionDisplay(v)}
                  </option>
                ))}
              </select>
            </div>
            {currentVersion && (
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <Stat label="Format" value={formatLabel[currentVersion.source_format] || currentVersion.source_format} />
                <Stat label="Activities" value={currentVersion.activity_count.toString()} />
                <Stat label="Mechanical" value={stats.mech.toString()} />
                <Stat label="Date Range" value={
                  stats.earliest && stats.latest ? `${fmtDate(stats.earliest)} → ${fmtDate(stats.latest)}` : '-'
                } />
                <Stat label="Uploaded" value={fmtTimestamp(currentVersion.uploaded_at)} />
                <Stat label="By" value={currentVersion.uploaded_by_name || '-'} />
              </div>
            )}
            {currentVersion && (
              <button
                className="btn btn-danger btn-sm"
                style={{ marginLeft: 'auto' }}
                onClick={() => {
                  if (window.confirm(`Delete this version (${currentVersion.activity_count} activities)?`)) {
                    deleteVersion.mutate(currentVersion.id);
                  }
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ) : !versionsQuery.isLoading && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--secondary)' }}>
          <h3>No schedules uploaded yet</h3>
          <p>Upload a GC schedule (Excel, CSV, Primavera XER, or PDF) to get started.</p>
          <button className="btn btn-primary" onClick={() => setUploadOpen(true)}>
            Upload Your First Schedule
          </button>
        </div>
      )}

      {diffOpen && versions.length >= 2 && (
        <DiffCard
          projectId={pid}
          versions={versions}
          a={diffA}
          b={diffB}
          onChangeA={setDiffA}
          onChangeB={setDiffB}
          data={diffQuery.data}
          loading={diffQuery.isLoading}
          projectName={project?.name || 'Project'}
          projectNumber={project?.number}
          generatedBy={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : null}
          logoUrl={logoUrl}
          projectTags={projectTags}
          projectTagGroups={projectTagGroups}
        />
      )}

      {effectiveVersionId && !diffOpen && (
        <>
          <div className="card" style={{ marginBottom: '0.75rem', padding: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search activities, IDs, WBS, responsible..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setSearchInput(''); setFilters((f) => ({ ...f, search: undefined })); }
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: searchInput ? '4px 26px 4px 8px' : '4px 8px', fontSize: 13 }}
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(''); setFilters((f) => ({ ...f, search: undefined })); }}
                    title="Clear search"
                    style={{
                      position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#9ca3af', fontSize: 15, lineHeight: 1, padding: 0,
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={!!filters.mechanicalOnly}
                  onChange={(e) => setFilters((f) => ({ ...f, mechanicalOnly: e.target.checked }))}
                />
                Mechanical only
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={!!filters.hideSummary}
                  onChange={(e) => setFilters((f) => ({ ...f, hideSummary: e.target.checked }))}
                />
                Hide summary rows
              </label>
              <TradeSelect
                value={filters.trade || ''}
                onChange={(v) => setFilters((f) => ({ ...f, trade: v || undefined }))}
              />
              <TagMultiFilter
                tags={projectTags}
                tagGroups={projectTagGroups}
                selectedIds={tagFilterIds}
                onChange={setTagFilterIds}
              />
            </div>
          </div>

          <div className="card" style={{ overflow: 'auto', padding: 0, maxHeight: 'calc(100vh - 320px)' }}>
            {selectedIds.size > 0 && (
              <div style={{
                display: 'flex', gap: 8, padding: '8px 12px',
                background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
                fontSize: 13, alignItems: 'center', position: 'sticky', top: 0, zIndex: 2,
              }}>
                <strong style={{ color: '#1e40af' }}>{selectedIds.size} selected</strong>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={bulkMech.isPending}
                  onClick={() => bulkMech.mutate({ ids: Array.from(selectedIds), on: true })}
                >
                  Mark Mechanical
                </button>
                <button
                  className="btn btn-sm"
                  disabled={bulkMech.isPending}
                  onClick={() => bulkMech.mutate({ ids: Array.from(selectedIds), on: false })}
                >
                  Mark Not Mechanical
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setTagAssignOpen(true)}
                  title="Assign or remove tags on the selected activities"
                >
                  Tag…
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setLinkPhaseOpen(true)}
                  title="Link the selected activities to a Phase Schedule item"
                >
                  Link to phase…
                </button>
                <button className="btn btn-sm" onClick={() => setSelectedIds(new Set())}>
                  Clear selection
                </button>
              </div>
            )}
            <table style={{ ...tableStyle, tableLayout: 'fixed', width: 'max-content', minWidth: '100%', cursor: resizing ? 'col-resize' : undefined }}>
              <thead onContextMenu={(e) => { e.preventDefault(); setColChooserPos({ x: e.clientX, y: e.clientY }); }}>
                <tr>
                  {/* expand/collapse — fixed width, no sort/resize */}
                  <th style={{ ...thStyle, width: 32, textAlign: 'center', padding: '4px 6px' }}>
                    {!sortKey && (
                      <button
                        onClick={() => {
                          const allSummaries = activities.filter((a) => a.is_summary).map((a) => a.display_order);
                          const anyExpanded = allSummaries.some((d) => !collapsed.has(d));
                          setCollapsed(anyExpanded ? new Set(allSummaries) : new Set());
                        }}
                        style={{ background: 'transparent', border: '1px solid #cbd5e1', borderRadius: 3, padding: '0 6px', height: 18, cursor: 'pointer', fontSize: 11, color: '#475569' }}
                        title="Toggle expand / collapse all"
                      >
                        {(() => {
                          const allSummaries = activities.filter((a) => a.is_summary).map((a) => a.display_order);
                          return allSummaries.some((d) => !collapsed.has(d)) ? '−' : '+';
                        })()}
                      </button>
                    )}
                  </th>
                  {/* checkbox — fixed width */}
                  <th style={{ ...thStyle, width: 28, textAlign: 'center', padding: '4px 6px' }}>
                    <input
                      type="checkbox"
                      checked={activities.filter((a) => !a.is_summary).length > 0 && activities.filter((a) => !a.is_summary).every((a) => selectedIds.has(a.id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(activities.filter((a) => !a.is_summary).map((a) => a.id)));
                        else setSelectedIds(new Set());
                      }}
                      title="Select all visible tasks"
                    />
                  </th>
                  {visibleColDefs.map(({ key, label, sortable }) => (
                    <th
                      key={key}
                      style={{ ...thStyle, width: colWidths[key] ?? DEFAULT_TAG_COL_WIDTH, position: 'relative', userSelect: 'none', cursor: sortable ? 'pointer' : 'default' }}
                      onClick={() => sortable && handleSort(key)}
                    >
                      {label}
                      {sortable && <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />}
                      <ResizeHandle onMouseDown={(e) => startResize(e, key)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activitiesQuery.isLoading && (
                  <tr><td colSpan={visibleColDefs.length + 2} style={{ ...tdStyle, textAlign: 'center', padding: '1.5rem' }}>Loading...</td></tr>
                )}
                {!activitiesQuery.isLoading && activities.length === 0 && (
                  <tr><td colSpan={visibleColDefs.length + 2} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>No activities match the filters.</td></tr>
                )}
                {sortKey
                  ? renderFlatRows({
                      activities,
                      sortKey,
                      sortDir,
                      selectedIds,
                      onToggleSelected: toggleSelected,
                      onToggleMech: (id, on) => toggleMech.mutate({ id, on }),
                      colDefs: visibleColDefs,
                    })
                  : renderTreeRows({
                      activities,
                      collapsed,
                      selectedIds,
                      onToggleCollapsed: toggleCollapsed,
                      onToggleSelected: toggleSelected,
                      onToggleMech: (id, on) => toggleMech.mutate({ id, on }),
                      colDefs: visibleColDefs,
                      onSelectChildren: (parentOrder, on) => {
                        const childIds = activities
                          .filter((a) => !a.is_summary && a.parent_summary_order === parentOrder)
                          .map((a) => a.id);
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (on) childIds.forEach((id) => next.add(id));
                          else childIds.forEach((id) => next.delete(id));
                          return next;
                        });
                      },
                    })
                }
              </tbody>
            </table>
          </div>
        </>
      )}
      {linkPhaseOpen && (
        <LinkSelectedToPhaseModal
          projectId={pid}
          selectedActivities={activities.filter((a) => selectedIds.has(a.id) && !!a.activity_id)}
          onClose={() => setLinkPhaseOpen(false)}
          onLinked={() => { setLinkPhaseOpen(false); setSelectedIds(new Set()); }}
        />
      )}
      {colChooserPos && (
        <ColumnChooser
          pos={colChooserPos}
          allCols={allColDefs}
          visibleCols={visibleCols}
          onToggle={toggleCol}
          onClose={() => setColChooserPos(null)}
        />
      )}
      {tagManagerOpen && (
        <TagManagerModal
          projectId={pid}
          onClose={() => setTagManagerOpen(false)}
        />
      )}
      {tagAssignOpen && (
        <TagAssignModal
          projectId={pid}
          selectedActivities={activities.filter((a) => selectedIds.has(a.id))}
          onClose={() => setTagAssignOpen(false)}
          onDone={() => { setTagAssignOpen(false); }}
        />
      )}
    </div>
  );
};

const LinkSelectedToPhaseModal: React.FC<{
  projectId: number;
  selectedActivities: GCScheduleActivity[];
  onClose: () => void;
  onLinked: () => void;
}> = ({ projectId, selectedActivities, onClose, onLinked }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [chosenPhaseId, setChosenPhaseId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phasesQuery = useQuery({
    queryKey: ['phaseScheduleItems', projectId],
    queryFn: () => phaseScheduleApi.getScheduleItems(projectId).then((r) => r.data),
  });
  const phases: PhaseScheduleItem[] = phasesQuery.data || [];

  const filteredPhases = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return phases;
    return phases.filter((p) =>
      (p.name || '').toLowerCase().includes(t) ||
      (p.phase_code_display || '').toLowerCase().includes(t)
    );
  }, [phases, search]);

  const chosen = phases.find((p) => p.id === chosenPhaseId) || null;
  const newActivityIds = selectedActivities.map((a) => a.activity_id!).filter(Boolean);

  const submit = async () => {
    if (!chosen) return;
    setBusy(true); setError(null);
    try {
      const existing = chosen.linked_gc_activities?.map((l) => l.activity_id) || [];
      const union = Array.from(new Set([...existing, ...newActivityIds]));
      await phaseScheduleLinksApi.replaceForItem(chosen.id, union);
      await queryClient.refetchQueries({ queryKey: ['phaseScheduleItems'] });
      onLinked();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to link');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 12, width: '90%', maxWidth: 540,
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
            Link {newActivityIds.length} activit{newActivityIds.length === 1 ? 'y' : 'ies'} to a phase
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            Pick a Phase Schedule item to receive these GC activity links.
          </div>
          <input
            type="text"
            placeholder="Search phases by name or phase code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', marginTop: 8, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {phasesQuery.isLoading && <div style={{ padding: 20, color: '#6b7280', fontSize: 13 }}>Loading phases…</div>}
          {!phasesQuery.isLoading && filteredPhases.length === 0 && (
            <div style={{ padding: 20, color: '#6b7280', fontSize: 13 }}>No phases match.</div>
          )}
          {filteredPhases.map((p) => {
            const selected = p.id === chosenPhaseId;
            const existingCount = p.linked_gc_activities?.length || 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setChosenPhaseId(p.id)}
                style={{
                  display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 16px', border: 'none', borderBottom: '1px solid #f3f4f6',
                  background: selected ? '#eff6ff' : 'transparent',
                  textAlign: 'left', cursor: 'pointer', fontSize: 13, color: '#111827',
                }}
              >
                <span>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  {p.phase_code_display && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: '#6b7280' }}>({p.phase_code_display})</span>
                  )}
                </span>
                {existingCount > 0 && (
                  <span style={{ fontSize: 11, color: '#0891b2' }}>🔗 {existingCount}</span>
                )}
              </button>
            );
          })}
        </div>
        {error && (
          <div style={{ padding: '8px 16px', color: '#b91c1c', fontSize: 12, background: '#fef2f2' }}>{error}</div>
        )}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: '#f9fafb' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {chosen ? (
              <>Will add to <strong>{chosen.name}</strong>{(chosen.linked_gc_activities?.length || 0) > 0 ? ` (already linked to ${chosen.linked_gc_activities!.length})` : ''}</>
            ) : (
              'Select a phase'
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-sm btn-primary" disabled={!chosen || busy || newActivityIds.length === 0} onClick={submit}>
              {busy ? 'Linking…' : 'Link'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const versionDisplay = (v: GCScheduleVersion): string => {
  const label = v.version_label || v.source_filename || `Version ${v.id}`;
  const date = v.schedule_date
    ? ` (${fmtDate(v.schedule_date)})`
    : ` (uploaded ${format(new Date(v.uploaded_at), 'M/d/yy')})`;
  return `${label}${date} — ${v.activity_count} activities`;
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{value}</div>
  </div>
);

const renderFlatRows = ({
  activities,
  sortKey,
  sortDir,
  selectedIds,
  onToggleSelected,
  onToggleMech,
  colDefs,
}: {
  activities: GCScheduleActivity[];
  sortKey: string;
  sortDir: 'asc' | 'desc';
  selectedIds: Set<number>;
  onToggleSelected: (id: number) => void;
  onToggleMech: (id: number, on: boolean) => void;
  colDefs: ColDef[];
}): React.ReactNode => {
  const tasks = activities.filter((a) => !a.is_summary);
  const mul = sortDir === 'asc' ? 1 : -1;
  const sorted = [...tasks].sort((a, b) => {
    const av = (a as any)[sortKey];
    const bv = (b as any)[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1 * mul;
    if (bv == null) return -1 * mul;
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * mul;
    return (Number(av) - Number(bv)) * mul;
  });
  return sorted.map((a) => (
    <TaskRow
      key={a.id}
      a={a}
      isSelected={selectedIds.has(a.id)}
      onToggleSelected={() => onToggleSelected(a.id)}
      onToggleMech={(on) => onToggleMech(a.id, on)}
      colDefs={colDefs}
    />
  ));
};

const renderTreeRows = ({
  activities,
  collapsed,
  selectedIds,
  onToggleCollapsed,
  onToggleSelected,
  onToggleMech,
  onSelectChildren,
  colDefs,
}: {
  activities: GCScheduleActivity[];
  collapsed: Set<number>;
  selectedIds: Set<number>;
  onToggleCollapsed: (displayOrder: number) => void;
  onToggleSelected: (id: number) => void;
  onToggleMech: (activityId: number, on: boolean) => void;
  onSelectChildren: (parentOrder: number, on: boolean) => void;
  colDefs: ColDef[];
}): React.ReactNode => {
  const childrenBySummary = new Map<number, GCScheduleActivity[]>();
  for (const a of activities) {
    if (a.is_summary) continue;
    if (a.parent_summary_order != null) {
      const list = childrenBySummary.get(a.parent_summary_order) || [];
      list.push(a);
      childrenBySummary.set(a.parent_summary_order, list);
    }
  }

  const out: React.ReactNode[] = [];
  for (const a of activities) {
    if (a.is_summary) {
      const children = childrenBySummary.get(a.display_order) || [];
      if (children.length === 0) continue;
      const isCollapsed = collapsed.has(a.display_order);
      const allChildrenSelected = children.every((c) => selectedIds.has(c.id));
      const someChildrenSelected = !allChildrenSelected && children.some((c) => selectedIds.has(c.id));
      out.push(
        <SummaryRow
          key={a.id}
          a={a}
          childCount={children.length}
          isCollapsed={isCollapsed}
          allChildrenSelected={allChildrenSelected}
          someChildrenSelected={someChildrenSelected}
          onClick={() => onToggleCollapsed(a.display_order)}
          onSelectChildren={(on) => onSelectChildren(a.display_order, on)}
          colDefs={colDefs}
        />
      );
    } else {
      const parentOrder = a.parent_summary_order;
      if (parentOrder != null && collapsed.has(parentOrder)) continue;
      out.push(
        <TaskRow
          key={a.id}
          a={a}
          isSelected={selectedIds.has(a.id)}
          onToggleSelected={() => onToggleSelected(a.id)}
          onToggleMech={(on) => onToggleMech(a.id, on)}
          colDefs={colDefs}
        />
      );
    }
  }
  return out;
};

const SummaryRow: React.FC<{
  a: GCScheduleActivity;
  childCount: number;
  isCollapsed: boolean;
  allChildrenSelected: boolean;
  someChildrenSelected: boolean;
  onClick: () => void;
  onSelectChildren: (on: boolean) => void;
  colDefs: ColDef[];
}> = ({ a, childCount, isCollapsed, allChildrenSelected, someChildrenSelected, onClick, onSelectChildren, colDefs }) => {
  const checkboxRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = someChildrenSelected;
  }, [someChildrenSelected]);

  const cellContent = (key: string): React.ReactNode => {
    switch (key) {
      case 'activity_name': return (
        <>{a.activity_name}<span style={{ marginLeft: 8, color: '#64748b', fontWeight: 400, fontSize: 11 }}>({childCount} task{childCount === 1 ? '' : 's'})</span></>
      );
      case 'start_date': return fmtDate(a.start_date);
      case 'finish_date': return fmtDate(a.finish_date);
      case 'duration_days': return a.duration_days ?? daysBetween(a.start_date, a.finish_date) ?? '-';
      case 'percent_complete': return a.percent_complete != null ? `${a.percent_complete}%` : '-';
      default: return null;
    }
  };

  return (
    <tr style={{ background: '#f1f5f9', borderTop: '1px solid #e2e8f0', fontWeight: 600 }}>
      <td
        onClick={onClick}
        style={{ ...tdStyle, textAlign: 'center', color: '#475569', userSelect: 'none', padding: '6px 4px', cursor: 'pointer' }}
      >
        {isCollapsed ? '▶' : '▼'}
      </td>
      <td style={{ ...tdStyle, textAlign: 'center', padding: '4px 6px' }} onClick={(e) => e.stopPropagation()}>
        <input
          ref={checkboxRef}
          type="checkbox"
          checked={allChildrenSelected}
          onChange={(e) => onSelectChildren(e.target.checked)}
          title={`Select all ${childCount} task${childCount === 1 ? '' : 's'} in this section`}
        />
      </td>
      {colDefs.map((col) => {
        const isName = col.key === 'activity_name';
        return (
          <td key={col.key} style={{ ...tdStyle, color: '#475569', cursor: 'pointer', ...(isName ? { color: '#0f172a' } : {}) }} onClick={onClick}>
            {cellContent(col.key)}
          </td>
        );
      })}
    </tr>
  );
};

const TaskRow: React.FC<{
  a: GCScheduleActivity;
  isSelected: boolean;
  onToggleSelected: () => void;
  onToggleMech: (on: boolean) => void;
  colDefs: ColDef[];
}> = ({ a, isSelected, onToggleSelected, onToggleMech, colDefs }) => {
  const rowBg = isSelected ? '#dbeafe' : a.is_mechanical ? '#ecfdf5' : undefined;

  const cellContent = (col: ColDef): React.ReactNode => {
    switch (col.key) {
      case 'activity_id': return <span style={{ fontSize: 12, color: '#475569' }}>{a.activity_id || '-'}</span>;
      case 'activity_name': return (
        <>
          {a.is_mechanical && (
            <span
              onClick={(e) => { e.stopPropagation(); onToggleMech(false); }}
              title={a.mechanical_override ? 'Manually set — click to unmark' : 'Auto-detected — click to unmark'}
              style={{ display: 'inline-block', background: '#10b981', color: 'white', borderRadius: 3, padding: '0 5px', fontSize: 10, marginRight: 6, cursor: 'pointer', border: a.mechanical_override ? '1px solid #b45309' : 'none' }}
            >MECH</span>
          )}
          {a.is_milestone ? '🏁 ' : ''}{a.activity_name}
        </>
      );
      case 'start_date': return fmtDate(a.start_date);
      case 'finish_date': return fmtDate(a.finish_date);
      case 'duration_days': return a.duration_days ?? daysBetween(a.start_date, a.finish_date) ?? '-';
      case 'percent_complete': return a.percent_complete != null ? `${a.percent_complete}%` : '-';
      case 'responsible': return a.responsible || '-';
      case 'tags_ungrouped': return <TagChips tags={(a.tags || []).filter((t) => !t.group_id)} />;
      default:
        if (col.groupId != null) return <TagChips tags={(a.tags || []).filter((t) => t.group_id === col.groupId)} />;
        return null;
    }
  };

  const isNumeric = (key: string) => key === 'duration_days' || key === 'percent_complete';
  const isNameCol = (key: string) => key === 'activity_name';

  return (
    <tr style={{ background: rowBg }}>
      <td style={{ ...tdStyle, padding: '4px 6px' }}></td>
      <td style={{ ...tdStyle, textAlign: 'center', padding: '4px 6px' }}>
        <input type="checkbox" checked={isSelected} onChange={onToggleSelected} />
      </td>
      {colDefs.map((col) => (
        <td
          key={col.key}
          style={{
            ...tdStyle,
            ...(isNameCol(col.key) ? { paddingLeft: 24 } : {}),
            ...(isNumeric(col.key) ? { textAlign: 'right' } : {}),
            ...((col.isTag || col.groupId != null) ? { whiteSpace: 'normal' } : {}),
          }}
        >
          {cellContent(col)}
        </td>
      ))}
    </tr>
  );
};

const UploadCard: React.FC<{ projectId: number; onUploaded: (warnings?: string[]) => void }> = ({ projectId, onUploaded }) => {
  const [file, setFile] = useState<File | null>(null);
  const [versionLabel, setVersionLabel] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: () => gcSchedulesApi.upload(projectId, file!, { versionLabel, scheduleDate, notes }),
    onSuccess: (res) => onUploaded(res.data.warnings),
    onError: (err: any) => setError(err?.response?.data?.message || err?.message || 'Upload failed'),
  });

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Upload GC Schedule</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
            File (.xlsx, .csv, .xer, .pdf)
          </label>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xls,.csv,.xer,.pdf,.xml"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
            Version Label (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Rev 3, Baseline, 3-26-26"
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
            style={{ width: '100%', padding: '0.4rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
            Schedule Date (optional)
          </label>
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            style={{ padding: '0.4rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
            Notes (optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: '100%', padding: '0.4rem' }}
          />
        </div>
      </div>
      {error && <div style={{ color: '#dc2626', marginBottom: '0.75rem', fontSize: '0.875rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className="btn btn-primary"
          disabled={!file || upload.isPending}
          onClick={() => { setError(null); upload.mutate(); }}
        >
          {upload.isPending ? 'Uploading…' : 'Upload & Parse'}
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--secondary)', marginTop: '0.75rem' }}>
        Excel, CSV, and Primavera XER imports are reliable. PDF parsing is best-effort — review rows
        afterward and ask the GC for a structured export when possible.
      </p>
    </div>
  );
};

const DiffCard: React.FC<{
  projectId: number;
  versions: GCScheduleVersion[];
  a: number | null;
  b: number | null;
  onChangeA: (id: number) => void;
  onChangeB: (id: number) => void;
  data: any;
  loading: boolean;
  projectName: string;
  projectNumber?: string | null;
  generatedBy?: string | null;
  logoUrl?: string;
  projectTags: GCScheduleTag[];
  projectTagGroups: GCScheduleTagGroup[];
}> = ({ versions, a, b, onChangeA, onChangeB, data, loading, projectName, projectNumber, generatedBy, logoUrl, projectTags, projectTagGroups }) => {
  const [mechanicalOnly, setMechanicalOnly] = useState(false);
  const [trade, setTrade] = useState<string>('');
  const [search, setSearch] = useState('');
  const [tagFilterIds, setTagFilterIds] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const matchesFilter = (row: any): boolean => {
    if (mechanicalOnly && !row.is_mechanical) return false;
    if (trade && row.trade !== trade) return false;
    if (tagFilterIds.length > 0) {
      const rowTagIds = (row.tags || []).map((t: any) => t.id);
      if (!tagFilterIds.some((id) => rowTagIds.includes(id))) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        row.activity_id, row.name, row.activity_name,
        row.wbs_code, row.responsible,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const filtered = data ? {
    added: (data.diff.added as any[]).filter(matchesFilter),
    removed: (data.diff.removed as any[]).filter(matchesFilter),
    changed: (data.diff.changed as any[]).filter(matchesFilter),
  } : null;

  const exportPdf = async () => {
    if (!data || !filtered) return;
    setExporting(true);
    try {
      let logoDataUrl: string | undefined;
      let logoAspect: number | undefined;
      if (logoUrl) {
        try {
          const resp = await api.get('/tenant/logo', { responseType: 'blob' });
          const blob = resp.data as Blob;
          const objectUrl = URL.createObjectURL(blob);
          ({ dataUrl: logoDataUrl, aspect: logoAspect } = await new Promise<{ dataUrl: string; aspect: number }>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || 1;
              canvas.height = img.naturalHeight || 1;
              canvas.getContext('2d')!.drawImage(img, 0, 0);
              URL.revokeObjectURL(objectUrl);
              resolve({ dataUrl: canvas.toDataURL('image/png'), aspect: img.naturalWidth / img.naturalHeight });
            };
            img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('img load failed')); };
            img.src = objectUrl;
          }));
        } catch (e) {
          console.warn('[GC Diff PDF] Logo load failed:', e);
        }
      }
      const fromV: GCScheduleVersion = data.a;
      const toV: GCScheduleVersion = data.b;
      const fileName = `GC_Schedule_Diff_${(projectNumber || 'Project').replace(/[^\w-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      exportGcScheduleDiffPdf({
        meta: {
          projectName,
          projectNumber,
          fromVersionLabel: versionDisplay(fromV),
          toVersionLabel: versionDisplay(toV),
          fromUploadedAt: fromV.uploaded_at,
          toUploadedAt: toV.uploaded_at,
          generatedBy,
        },
        counts: {
          changed: filtered.changed.length,
          added: filtered.added.length,
          removed: filtered.removed.length,
        },
        changed: filtered.changed,
        added: filtered.added,
        removed: filtered.removed,
        fileName,
        logoDataUrl,
        logoAspect,
      });
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = () => {
    if (!data || !filtered) return;
    setExportingExcel(true);
    try {
      const fromV: GCScheduleVersion = data.a;
      const toV: GCScheduleVersion = data.b;
      const fileName = `GC_Schedule_Diff_${(projectNumber || 'Project').replace(/[^\w-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      exportGcScheduleDiffExcel({
        meta: {
          projectName,
          projectNumber,
          fromVersionLabel: versionDisplay(fromV),
          toVersionLabel: versionDisplay(toV),
          fromUploadedAt: fromV.uploaded_at,
          toUploadedAt: toV.uploaded_at,
          generatedBy,
        },
        counts: {
          changed: filtered.changed.length,
          added: filtered.added.length,
          removed: filtered.removed.length,
        },
        changed: filtered.changed,
        added: filtered.added,
        removed: filtered.removed,
        fileName,
      });
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Compare Versions</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-sm"
            style={{ background: '#217346', color: '#fff', border: 'none' }}
            disabled={!filtered || loading || exportingExcel}
            onClick={exportExcel}
            title="Download an Excel workbook with all differences (Changed, Added, Removed sheets)"
          >
            {exportingExcel ? 'Exporting…' : 'Export Excel'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!filtered || loading || exporting}
            onClick={exportPdf}
            title="Download a PDF report of the differences between these two versions"
          >
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>From (older)</label>
          <select value={a || ''} onChange={(e) => onChangeA(Number(e.target.value))} style={{ minWidth: 250, padding: '4px 6px', fontSize: 13 }}>
            {versions.map((v) => <option key={v.id} value={v.id}>{versionDisplay(v)}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>To (newer)</label>
          <select value={b || ''} onChange={(e) => onChangeB(Number(e.target.value))} style={{ minWidth: 250, padding: '4px 6px', fontSize: 13 }}>
            {versions.map((v) => <option key={v.id} value={v.id}>{versionDisplay(v)}</option>)}
          </select>
        </div>
      </div>

      {data && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 13, padding: 10, background: '#f9fafb', borderRadius: 6 }}>
          <input
            type="text"
            placeholder="Search activity name, ID, WBS, responsible..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 220, padding: '4px 8px', fontSize: 13 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="checkbox" checked={mechanicalOnly} onChange={(e) => setMechanicalOnly(e.target.checked)} />
            Mechanical only
          </label>
          <TradeSelect value={trade} onChange={setTrade} />
          <TagMultiFilter
            tags={projectTags}
            tagGroups={projectTagGroups}
            selectedIds={tagFilterIds}
            onChange={setTagFilterIds}
          />
          {(mechanicalOnly || trade || search || tagFilterIds.length > 0) && (
            <button className="btn btn-sm" onClick={() => { setMechanicalOnly(false); setTrade(''); setSearch(''); setTagFilterIds([]); }}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading && <div>Loading diff…</div>}
      {filtered && (
        <>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
            <Stat label="Added" value={`${filtered.added.length}${filtered.added.length !== data.diff.added.length ? ` of ${data.diff.added.length}` : ''}`} />
            <Stat label="Removed" value={`${filtered.removed.length}${filtered.removed.length !== data.diff.removed.length ? ` of ${data.diff.removed.length}` : ''}`} />
            <Stat label="Changed" value={`${filtered.changed.length}${filtered.changed.length !== data.diff.changed.length ? ` of ${data.diff.changed.length}` : ''}`} />
          </div>
          <DiffSection title="Changed" rows={filtered.changed} kind="changed" />
          <DiffSection title="Added (only in newer)" rows={filtered.added} kind="added" />
          <DiffSection title="Removed (only in older)" rows={filtered.removed} kind="removed" />
          {filtered.changed.length === 0 && filtered.added.length === 0 && filtered.removed.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              No differences match the current filters.
            </div>
          )}
        </>
      )}
    </div>
  );
};

const DiffSection: React.FC<{ title: string; rows: any[]; kind: 'added' | 'removed' | 'changed' }> = ({ title, rows, kind }) => {
  if (!rows.length) return null;
  const colCount = kind === 'changed' ? 4 : 5;
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h4 style={{ marginBottom: '0.4rem', fontSize: 13 }}>{title} ({rows.length})</h4>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Activity ID</th>
            <th style={thStyle}>Name</th>
            {kind === 'changed'
              ? <th style={thStyle}>What changed</th>
              : <><th style={thStyle}>Start</th><th style={thStyle}>Finish</th></>
            }
            <th style={thStyle}>Tags</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((r, i) => (
            <tr key={i} style={{ background: kind === 'added' ? '#ecfdf5' : kind === 'removed' ? '#fef2f2' : '#fffbeb' }}>
              <td style={{ ...tdStyle, fontSize: 12, color: '#475569' }}>{r.activity_id || '-'}</td>
              <td style={tdStyle}>{r.name || r.activity_name}{r.is_mechanical ? ' ⚙' : ''}</td>
              {kind === 'changed' ? (
                <td style={{ ...tdStyle, fontSize: 12, whiteSpace: 'normal' }}>
                  {renderChangeLines(r.diffs)}
                </td>
              ) : (
                <>
                  <td style={tdStyle}>{fmtDate(r.start_date)}</td>
                  <td style={tdStyle}>{fmtDate(r.finish_date)}</td>
                </>
              )}
              <td style={{ ...tdStyle, whiteSpace: 'normal' }}>
                <TagChips tags={r.tags} />
              </td>
            </tr>
          ))}
          {rows.length > 200 && (
            <tr><td colSpan={colCount} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>Showing first 200 of {rows.length}.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default GCScheduleView;
