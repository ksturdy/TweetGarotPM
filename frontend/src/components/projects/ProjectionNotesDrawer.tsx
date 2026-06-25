import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  projectionNotesApi,
  ProjectionNote,
  ProjectionNoteType,
  CreateProjectionNotePayload,
  NOTE_CATEGORIES,
  GAIN_FADE_GROUPS,
} from '../../services/projectionNotes';
import { usersApi } from '../../services/users';
import SearchableSelect from '../SearchableSelect';
import { format } from 'date-fns';

const COST_TYPES: { value: number | null; label: string }[] = [
  { value: null, label: 'Contract-wide' },
  { value: 1, label: 'Labor' },
  { value: 2, label: 'Material' },
  { value: 3, label: 'Subcontracts' },
  { value: 4, label: 'Rentals' },
  { value: 5, label: 'MEP Equipment' },
  { value: 6, label: 'General Conditions' },
];

const costTypeLabel = (n: number | null): string => {
  const found = COST_TYPES.find(c => c.value === n);
  return found ? found.label : 'Contract-wide';
};

const fmtMoney = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '-';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
};

const fmtMoneySigned = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '-';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '-';
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(n));
  return n < 0 ? `(${formatted})` : formatted;
};

interface Props {
  projectId: number;
  open: boolean;
  onClose: () => void;
}

type TabKey = 'note' | 'gain_fade';
type NoteFilter = 'all' | 'open_tasks' | 'notes_only' | 'done';

const isTask = (n: ProjectionNote) => n.assigned_to != null || n.due_date != null;

const ProjectionNotesDrawer: React.FC<Props> = ({ projectId, open, onClose }) => {
  const [tab, setTab] = useState<TabKey>('note');
  const queryClient = useQueryClient();

  const { data: notes = [] } = useQuery({
    queryKey: ['projectionNotes', projectId],
    queryFn: () => projectionNotesApi.list(projectId).then(r => r.data),
    enabled: open,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then(r => r.data.filter(u => u.is_active)),
    enabled: open && tab === 'note',
  });

  const notesByType = useMemo(() => ({
    note: notes.filter(n => n.type === 'note'),
    gain_fade: notes.filter(n => n.type === 'gain_fade'),
  }), [notes]);

  const openTaskCount = notesByType.note.filter(n => isTask(n) && n.status === 'open').length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['projectionNotes', projectId] });
    queryClient.invalidateQueries({ queryKey: ['projectionNoteCounts', projectId] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateProjectionNotePayload) => projectionNotesApi.create(projectId, payload),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectionNotesApi.delete(projectId, id),
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'open' | 'done' }) =>
      projectionNotesApi.setStatus(projectId, id, status),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      projectionNotesApi.update(projectId, id, payload),
    onSuccess: invalidate,
  });

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.35)',
          zIndex: 1000,
        }}
      />
      {/* Drawer */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(640px, 100vw)', background: '#fff',
          boxShadow: '-8px 0 24px rgba(15, 23, 42, 0.15)',
          zIndex: 1001, display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>Projection Notes</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '1.25rem',
            cursor: 'pointer', color: '#64748b', padding: '0 0.25rem',
          }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <TabButton active={tab === 'note'} onClick={() => setTab('note')}
            label="Notes" count={notesByType.note.length} badge={openTaskCount} />
          <TabButton active={tab === 'gain_fade'} onClick={() => setTab('gain_fade')}
            label="Gain / Fade" count={notesByType.gain_fade.length} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
          {tab === 'note' && (
            <NotesTab
              items={notesByType.note}
              users={users}
              onCreate={(payload) => createMutation.mutate(payload)}
              onDelete={(id) => deleteMutation.mutate(id)}
              onToggleStatus={(id, status) => statusMutation.mutate({ id, status })}
              creating={createMutation.isPending}
            />
          )}
          {tab === 'gain_fade' && (
            <GainFadeTab
              items={notesByType.gain_fade}
              onCreate={(payload) => createMutation.mutate(payload)}
              onUpdate={(id, payload) => updateMutation.mutate({ id, payload })}
              onDelete={(id) => deleteMutation.mutate(id)}
              creating={createMutation.isPending}
            />
          )}
        </div>
      </div>
    </>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; count: number; badge?: number }> = ({ active, onClick, label, count, badge }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1, padding: '0.6rem 0.5rem', background: 'none',
      border: 'none', borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
      cursor: 'pointer', fontSize: '0.8rem',
      fontWeight: active ? 700 : 500, color: active ? '#2563eb' : '#475569',
    }}
  >
    {label} <span style={{ color: '#94a3b8' }}>({count})</span>
    {badge !== undefined && badge > 0 && (
      <span style={{
        marginLeft: '0.35rem', background: '#ef4444', color: '#fff',
        borderRadius: '999px', padding: '0.05rem 0.4rem', fontSize: '0.65rem',
      }}>{badge}</span>
    )}
  </button>
);

/* ============ NOTES TAB (notes + tasks merged) ============ */

const NotesTab: React.FC<{
  items: ProjectionNote[];
  users: { id: number; first_name: string; last_name: string; email: string }[];
  onCreate: (p: CreateProjectionNotePayload) => void;
  onDelete: (id: number) => void;
  onToggleStatus: (id: number, status: 'open' | 'done') => void;
  creating: boolean;
}> = ({ items, users, onCreate, onDelete, onToggleStatus, creating }) => {
  const [body, setBody] = useState('');
  const [costType, setCostType] = useState<number | null>(null);
  const [category, setCategory] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [filter, setFilter] = useState<NoteFilter>('all');

  const submit = () => {
    if (!body.trim()) return;
    onCreate({
      type: 'note', body: body.trim(),
      cost_type: costType, category: category || null,
      assigned_to: assignedTo, due_date: dueDate || null,
    });
    setBody(''); setCostType(null); setCategory('');
    setAssignedTo(null); setDueDate('');
  };

  const filtered = items.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'open_tasks') return isTask(n) && n.status === 'open';
    if (filter === 'done') return n.status === 'done';
    if (filter === 'notes_only') return !isTask(n);
    return true;
  });

  const isTaskForm = assignedTo != null || dueDate !== '';

  return (
    <div>
      <div style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Scope</label>
            <select value={costType ?? ''} onChange={e => setCostType(e.target.value === '' ? null : Number(e.target.value))}
              style={inputStyle}>
              {COST_TYPES.map(c => (
                <option key={c.label} value={c.value ?? ''}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              style={inputStyle}>
              <option value="">— None —</option>
              {NOTE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <label style={{ ...labelStyle, marginTop: '0.5rem' }}>Note</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
          placeholder="Add context or describe a task..."
          style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} />
        <div style={{ ...labelStyle, marginTop: '0.6rem', color: '#94a3b8' }}>
          Assign as a task (optional)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Assign To</label>
            <SearchableSelect
              options={users.map(u => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }))}
              value={assignedTo != null ? String(assignedTo) : ''}
              onChange={(val) => setAssignedTo(val ? Number(val) : null)}
              placeholder="Search user..."
            />
          </div>
          <div>
            <label style={labelStyle}>Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              style={inputStyle} />
          </div>
        </div>
        <button onClick={submit} disabled={creating || !body.trim()}
          className="btn btn-primary" style={{ marginTop: '0.6rem', fontSize: '0.75rem' }}>
          {creating ? 'Adding...' : (isTaskForm ? 'Add Task' : 'Add Note')}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        {([
          ['all', 'All'],
          ['open_tasks', 'Open Tasks'],
          ['notes_only', 'Notes Only'],
          ['done', 'Done'],
        ] as [NoteFilter, string][]).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              fontSize: '0.7rem', padding: '0.2rem 0.55rem', borderRadius: '4px',
              border: filter === f ? '2px solid #2563eb' : '1px solid #cbd5e1',
              background: filter === f ? '#eff6ff' : '#fff', cursor: 'pointer',
              fontWeight: filter === f ? 600 : 400,
            }}>{label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState label="Nothing here." />
      ) : (
        filtered.map(n => {
          const task = isTask(n);
          const done = n.status === 'done';
          return (
            <NoteCard key={n.id} note={n} onDelete={() => onDelete(n.id)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                {task && (
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={e => onToggleStatus(n.id, e.target.checked ? 'done' : 'open')}
                    style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                    title={done ? 'Mark open' : 'Mark done'}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.3rem' }}>
                    {n.category && (
                      <span style={{
                        fontSize: '0.65rem', color: '#0369a1',
                        background: '#e0f2fe', border: '1px solid #bae6fd',
                        borderRadius: '999px', padding: '0.05rem 0.5rem',
                      }}>{n.category}</span>
                    )}
                    {task && (
                      <span style={{
                        fontSize: '0.65rem',
                        color: done ? '#15803d' : '#b45309',
                        background: done ? '#dcfce7' : '#fef3c7',
                        border: `1px solid ${done ? '#86efac' : '#fde68a'}`,
                        borderRadius: '999px', padding: '0.05rem 0.5rem',
                      }}>{done ? 'Done' : 'Task'}</span>
                    )}
                  </div>
                  <div style={{
                    whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#1e293b',
                    textDecoration: done ? 'line-through' : 'none',
                    opacity: done ? 0.6 : 1,
                  }}>{n.body}</div>
                  {(n.assigned_to_name || n.due_date || n.snapshot_date) && (
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {n.assigned_to_name && <span>👤 {n.assigned_to_name}</span>}
                      {n.due_date && <span>📅 {format(new Date(n.due_date), 'MMM d, yyyy')}</span>}
                      {n.snapshot_date && <span style={{ color: '#94a3b8' }}>from {format(new Date(n.snapshot_date), 'MMM d')}</span>}
                    </div>
                  )}
                </div>
              </div>
            </NoteCard>
          );
        })
      )}
    </div>
  );
};

/* ============ GAIN/FADE TAB ============ */

const GainFadeTab: React.FC<{
  items: ProjectionNote[];
  onCreate: (p: CreateProjectionNotePayload) => void;
  onUpdate: (id: number, payload: any) => void;
  onDelete: (id: number) => void;
  creating: boolean;
}> = ({ items, onCreate, onUpdate, onDelete, creating }) => {
  const [body, setBody] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'gain' | 'fade'>('gain');
  const [costType, setCostType] = useState<number | null>(null);
  const [recognized, setRecognized] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDirection, setEditDirection] = useState<'gain' | 'fade'>('gain');
  const [editCostType, setEditCostType] = useState<number | null>(null);
  const [editGroups, setEditGroups] = useState<string[]>([]);

  const startEdit = (n: ProjectionNote) => {
    const v = typeof n.amount === 'string' ? parseFloat(n.amount) : (n.amount || 0);
    setEditingId(n.id);
    setEditBody(n.body);
    setEditAmount(String(Math.abs(v)));
    setEditDirection(v >= 0 ? 'gain' : 'fade');
    setEditCostType(n.cost_type ?? null);
    setEditGroups(n.groups_affected ?? []);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = (n: ProjectionNote) => {
    const num = parseFloat(editAmount.replace(/,/g, ''));
    if (isNaN(num) || !editBody.trim()) return;
    const signed = editDirection === 'gain' ? Math.abs(num) : -Math.abs(num);
    onUpdate(n.id, {
      body: editBody.trim(),
      amount: signed,
      cost_type: editCostType,
      groups_affected: editGroups.length > 0 ? editGroups : null,
    });
    setEditingId(null);
  };

  const toggleGroup = (g: string) => {
    setGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  const submit = () => {
    if (!body.trim() || !amount) return;
    const num = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(num)) return;
    const signed = direction === 'gain' ? Math.abs(num) : -Math.abs(num);
    onCreate({
      type: 'gain_fade', body: body.trim(),
      amount: signed, cost_type: costType,
      groups_affected: groups.length > 0 ? groups : null,
      recognized_in_financials: recognized,
      recognized_at: recognized ? new Date().toISOString().split('T')[0] : null,
    });
    setBody(''); setAmount(''); setDirection('gain'); setCostType(null);
    setRecognized(false); setGroups([]);
  };

  const totals = useMemo(() => {
    let gain = 0, fade = 0, recognizedNet = 0, unrecognizedNet = 0;
    items.forEach(n => {
      const v = typeof n.amount === 'string' ? parseFloat(n.amount) : (n.amount || 0);
      if (v > 0) gain += v; else fade += v;
      if (n.recognized_in_financials) recognizedNet += v; else unrecognizedNet += v;
    });
    return { gain, fade, net: gain + fade, recognized: recognizedNet, unrecognized: unrecognizedNet };
  }, [items]);

  return (
    <div>
      <div style={cardStyle}>
        <label style={labelStyle}>Description</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={2}
          placeholder="Describe the gain or fade..."
          style={{ ...inputStyle, resize: 'vertical', minHeight: '50px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={direction} onChange={e => setDirection(e.target.value as 'gain' | 'fade')}
              style={inputStyle}>
              <option value="gain">Gain (+)</option>
              <option value="fade">Fade (-)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Amount</label>
            <input type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
              placeholder="0" style={inputStyle} />
          </div>
        </div>
        <label style={{ ...labelStyle, marginTop: '0.5rem' }}>Cost Type</label>
        <select value={costType ?? ''} onChange={e => setCostType(e.target.value === '' ? null : Number(e.target.value))}
          style={inputStyle}>
          {COST_TYPES.map(c => (
            <option key={c.label} value={c.value ?? ''}>{c.label}</option>
          ))}
        </select>
        <label style={{ ...labelStyle, marginTop: '0.5rem' }}>Groups Affected</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {GAIN_FADE_GROUPS.map(g => {
            const on = groups.includes(g);
            return (
              <button key={g} type="button" onClick={() => toggleGroup(g)}
                style={{
                  fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '999px',
                  border: on ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  background: on ? '#eff6ff' : '#fff',
                  color: on ? '#1e40af' : '#475569',
                  cursor: 'pointer', fontWeight: on ? 600 : 400,
                }}>{g}</button>
            );
          })}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#475569' }}>
          <input type="checkbox" checked={recognized} onChange={e => setRecognized(e.target.checked)} />
          Already recognized in financials
        </label>
        <button onClick={submit} disabled={creating || !body.trim() || !amount}
          className="btn btn-primary" style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
          {creating ? 'Adding...' : 'Add Item'}
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState label="No gain/fade items yet." />
      ) : (
        <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={gfTh}>Date</th>
                <th style={gfTh}>Cost Type</th>
                <th style={{ ...gfTh, textAlign: 'left' }}>Description</th>
                <th style={{ ...gfTh, textAlign: 'left' }}>Groups</th>
                <th style={{ ...gfTh, textAlign: 'right' }}>Amount</th>
                <th style={gfTh}>Recog?</th>
                <th style={gfTh}></th>
              </tr>
            </thead>
            <tbody>
              {items.map(n => {
                const v = typeof n.amount === 'string' ? parseFloat(n.amount) : (n.amount || 0);
                const isEditing = editingId === n.id;
                if (isEditing) {
                  return (
                    <tr key={n.id} style={{ borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
                      <td style={gfTd}>{format(new Date(n.created_at), 'MM/dd')}</td>
                      <td style={gfTd}>
                        <select value={editCostType ?? ''} onChange={e => setEditCostType(e.target.value === '' ? null : Number(e.target.value))}
                          style={{ fontSize: '0.7rem', padding: '0.15rem', width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                          {COST_TYPES.map(c => (
                            <option key={c.label} value={c.value ?? ''}>{c.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ ...gfTd, textAlign: 'left' }}>
                        <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={2}
                          style={{ fontSize: '0.7rem', width: '100%', padding: '0.15rem', border: '1px solid #cbd5e1', borderRadius: '4px', resize: 'vertical' }} />
                      </td>
                      <td style={{ ...gfTd, textAlign: 'left' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                          {GAIN_FADE_GROUPS.map(g => {
                            const on = editGroups.includes(g);
                            return (
                              <button key={g} type="button"
                                onClick={() => setEditGroups(prev => on ? prev.filter(x => x !== g) : [...prev, g])}
                                style={{
                                  fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '999px',
                                  border: on ? '1px solid #2563eb' : '1px solid #cbd5e1',
                                  background: on ? '#eff6ff' : '#fff',
                                  color: on ? '#1e40af' : '#475569', cursor: 'pointer',
                                }}>{g}</button>
                            );
                          })}
                        </div>
                      </td>
                      <td style={{ ...gfTd, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <select value={editDirection} onChange={e => setEditDirection(e.target.value as 'gain' | 'fade')}
                            style={{ fontSize: '0.7rem', padding: '0.15rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                            <option value="gain">+</option>
                            <option value="fade">−</option>
                          </select>
                          <input type="text" inputMode="numeric" value={editAmount}
                            onChange={e => setEditAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                            style={{ fontSize: '0.7rem', width: '72px', padding: '0.15rem', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'right' }} />
                        </div>
                      </td>
                      <td style={gfTd}>
                        <input type="checkbox" checked={n.recognized_in_financials}
                          onChange={e => onUpdate(n.id, {
                            recognized_in_financials: e.target.checked,
                            recognized_at: e.target.checked ? new Date().toISOString().split('T')[0] : null,
                          })} style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ ...gfTd, whiteSpace: 'nowrap' }}>
                        <button onClick={() => saveEdit(n)}
                          style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                          title="Save">✓</button>
                        <button onClick={cancelEdit}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                          title="Cancel">×</button>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={n.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={gfTd}>{format(new Date(n.created_at), 'MM/dd')}</td>
                    <td style={gfTd}>{costTypeLabel(n.cost_type)}</td>
                    <td style={{ ...gfTd, textAlign: 'left' }}>
                      <div style={{ color: '#1e293b' }}>{n.body}</div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>by {n.created_by_name}</div>
                    </td>
                    <td style={{ ...gfTd, textAlign: 'left' }}>
                      {n.groups_affected && n.groups_affected.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                          {n.groups_affected.map(g => (
                            <span key={g} style={{
                              fontSize: '0.6rem', color: '#1e40af', background: '#eff6ff',
                              border: '1px solid #bfdbfe', borderRadius: '999px',
                              padding: '0.05rem 0.35rem', whiteSpace: 'nowrap',
                            }}>{g}</span>
                          ))}
                        </div>
                      ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{
                      ...gfTd, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600, color: v >= 0 ? '#10b981' : '#ef4444',
                    }}>{fmtMoneySigned(v)}</td>
                    <td style={gfTd}>
                      <input
                        type="checkbox"
                        checked={n.recognized_in_financials}
                        onChange={e => onUpdate(n.id, {
                          recognized_in_financials: e.target.checked,
                          recognized_at: e.target.checked ? new Date().toISOString().split('T')[0] : null,
                        })}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ ...gfTd, whiteSpace: 'nowrap' }}>
                      <button onClick={() => startEdit(n)}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8rem' }}
                        title="Edit">✎</button>
                      <button onClick={() => onDelete(n.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}
                        title="Delete">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1' }}>
                <td style={gfTf} colSpan={4}>Total Gain</td>
                <td style={{ ...gfTf, textAlign: 'right', color: '#10b981' }}>{fmtMoneySigned(totals.gain)}</td>
                <td style={gfTf} colSpan={2}></td>
              </tr>
              <tr style={{ background: '#f8fafc' }}>
                <td style={gfTf} colSpan={4}>Total Fade</td>
                <td style={{ ...gfTf, textAlign: 'right', color: '#ef4444' }}>{fmtMoneySigned(totals.fade)}</td>
                <td style={gfTf} colSpan={2}></td>
              </tr>
              <tr style={{ background: '#eff6ff', borderTop: '2px solid #cbd5e1' }}>
                <td style={{ ...gfTf, fontWeight: 700 }} colSpan={4}>Net</td>
                <td style={{ ...gfTf, textAlign: 'right', fontWeight: 700, color: totals.net >= 0 ? '#10b981' : '#ef4444' }}>
                  {fmtMoneySigned(totals.net)}
                </td>
                <td style={gfTf} colSpan={2}></td>
              </tr>
              <tr style={{ background: '#f8fafc' }}>
                <td style={{ ...gfTf, fontStyle: 'italic', color: '#475569' }} colSpan={4}>Recognized</td>
                <td style={{ ...gfTf, textAlign: 'right', color: '#475569' }}>{fmtMoneySigned(totals.recognized)}</td>
                <td style={gfTf} colSpan={2}></td>
              </tr>
              <tr style={{ background: '#f8fafc' }}>
                <td style={{ ...gfTf, fontStyle: 'italic', color: '#b45309' }} colSpan={4}>Unrecognized</td>
                <td style={{ ...gfTf, textAlign: 'right', color: '#b45309' }}>{fmtMoneySigned(totals.unrecognized)}</td>
                <td style={gfTf} colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

/* ============ SHARED ============ */

const NoteCard: React.FC<{ note: ProjectionNote; onDelete: () => void; children: React.ReactNode }> = ({ note, onDelete, children }) => (
  <div style={{
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px',
    padding: '0.6rem 0.75rem', marginBottom: '0.5rem',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
        <strong>{note.created_by_name}</strong>
        {' · '}{format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
        {' · '}<span style={{ color: '#94a3b8' }}>{costTypeLabel(note.cost_type)}</span>
      </div>
      <button onClick={onDelete}
        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem', padding: '0 0.25rem' }}
        title="Delete">×</button>
    </div>
    {children}
  </div>
);

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
    {label}
  </div>
);

const cardStyle: React.CSSProperties = {
  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px',
  padding: '0.75rem', marginBottom: '0.75rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#475569',
  marginBottom: '0.2rem', textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  width: '100%', fontSize: '0.8rem', padding: '0.35rem 0.5rem',
  border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff',
  boxSizing: 'border-box',
};

const gfTh: React.CSSProperties = {
  fontSize: '0.65rem', padding: '0.4rem 0.5rem', textAlign: 'center',
  color: '#475569', fontWeight: 600, textTransform: 'uppercase',
  borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
};

const gfTd: React.CSSProperties = {
  fontSize: '0.75rem', padding: '0.4rem 0.5rem', textAlign: 'center',
  color: '#334155',
};

const gfTf: React.CSSProperties = {
  fontSize: '0.75rem', padding: '0.4rem 0.5rem', textAlign: 'left',
  color: '#334155', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
};

export default ProjectionNotesDrawer;
