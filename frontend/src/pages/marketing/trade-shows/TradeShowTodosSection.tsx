import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  tradeShowsApi,
  TradeShowTodo,
  TradeShowTodoStatus,
  TradeShowTodoPriority,
  TODO_STATUS_OPTIONS,
  TODO_PRIORITY_OPTIONS,
  REMINDER_OFFSET_OPTIONS,
} from '../../../services/tradeShows';
import { usersApi, User } from '../../../services/users';
import SearchableSelect from '../../../components/SearchableSelect';
import { useTitanFeedback } from '../../../context/TitanFeedbackContext';

interface Props {
  tradeShowId: number;
  todos: TradeShowTodo[];
}

const sectionTitle: React.CSSProperties = {
  fontSize: '0.9rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#475569',
  marginTop: 0,
  marginBottom: '1rem',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid #e5e7eb',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#6b7280',
  fontWeight: 600,
  marginBottom: '0.25rem',
};

const fmtDate = (val?: string | null) => {
  if (!val) return '';
  const d = new Date(val.includes('T') ? val : val + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtTime = (val?: string | null) => {
  if (!val) return '';
  const t = val.length >= 5 ? val.slice(0, 5) : val;
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr);
  if (isNaN(h)) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${period}`;
};

const dueText = (t: TradeShowTodo) => {
  const date = fmtDate(t.due_date);
  const time = fmtTime(t.due_time);
  if (!date && !time) return '';
  return [date, time].filter(Boolean).join(' • ');
};

const dueState = (t: TradeShowTodo): 'overdue' | 'soon' | 'normal' | 'none' => {
  if (!t.due_date || t.status === 'done') return 'none';
  const due = new Date(t.due_date.includes('T') ? t.due_date : t.due_date + 'T00:00:00');
  if (t.due_time) {
    const [h, m] = t.due_time.split(':');
    due.setHours(parseInt(h) || 0, parseInt(m) || 0, 0, 0);
  } else {
    due.setHours(23, 59, 59, 999);
  }
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  if (diffMs < 0) return 'overdue';
  if (diffMs < 1000 * 60 * 60 * 24) return 'soon';
  return 'normal';
};

const priorityBadge = (p: TradeShowTodoPriority): React.CSSProperties => {
  const opt = TODO_PRIORITY_OPTIONS.find(o => o.value === p);
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'white',
    backgroundColor: opt?.color || '#6b7280',
  };
};

const reminderLabel = (mins?: number | null): string => {
  if (mins === null || mins === undefined) return 'No reminder';
  const opt = REMINDER_OFFSET_OPTIONS.find(o => o.value === mins);
  if (opt) return opt.label;
  return `${mins} minutes before`;
};

type TodoFormState = {
  title: string;
  description: string;
  status: TradeShowTodoStatus;
  priority: TradeShowTodoPriority;
  due_date: string;
  due_time: string;
  reminder_offset_minutes: string; // store as string in form, '' = no reminder
  assigned_to_user_id: string;
};

const emptyTodo: TodoFormState = {
  title: '',
  description: '',
  status: 'open',
  priority: 'normal',
  due_date: '',
  due_time: '',
  reminder_offset_minutes: '',
  assigned_to_user_id: '',
};

const TradeShowTodosSection: React.FC<Props> = ({ tradeShowId, todos }) => {
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TradeShowTodo | null>(null);
  const [form, setForm] = useState<TodoFormState>(emptyTodo);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then(res => res.data),
  });

  const userOptions = useMemo(() => {
    return (users || [])
      .filter((u: User) => u.is_active !== false)
      .map((u: User) => ({
        value: u.id.toString(),
        label: `${u.first_name} ${u.last_name}`,
        searchText: `${u.first_name} ${u.last_name} ${u.email || ''}`,
      }));
  }, [users]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['trade-show', String(tradeShowId)] });

  const addMutation = useMutation({
    mutationFn: (data: Partial<TradeShowTodo>) => tradeShowsApi.addTodo(tradeShowId, data),
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to add task'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ todoId, data }: { todoId: number; data: Partial<TradeShowTodo> }) =>
      tradeShowsApi.updateTodo(tradeShowId, todoId, data),
    onSuccess: () => { invalidate(); closeModal(); },
    onError: (err: any) => setError(err?.response?.data?.error || 'Failed to update task'),
  });

  const deleteMutation = useMutation({
    mutationFn: (todoId: number) => tradeShowsApi.removeTodo(tradeShowId, todoId),
    onSuccess: invalidate,
  });

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(emptyTodo);
    setError(null);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyTodo);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (t: TradeShowTodo) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description || '',
      status: t.status,
      priority: t.priority,
      due_date: (t.due_date || '').split('T')[0],
      due_time: (t.due_time || '').slice(0, 5),
      reminder_offset_minutes:
        t.reminder_offset_minutes === null || t.reminder_offset_minutes === undefined
          ? ''
          : String(t.reminder_offset_minutes),
      assigned_to_user_id: t.assigned_to_user_id ? t.assigned_to_user_id.toString() : '',
    });
    setError(null);
    setShowModal(true);
  };

  const handleDelete = async (t: TradeShowTodo) => {
    const ok = await confirm({
      message: `Delete task "${t.title}"?`,
      title: 'Delete Task',
      danger: true,
    });
    if (ok) deleteMutation.mutate(t.id);
  };

  const toggleDone = (t: TradeShowTodo) => {
    const nextStatus: TradeShowTodoStatus = t.status === 'done' ? 'open' : 'done';
    updateMutation.mutate({
      todoId: t.id,
      data: {
        title: t.title,
        description: t.description ?? null,
        status: nextStatus,
        priority: t.priority,
        due_date: t.due_date ?? null,
        due_time: t.due_time ?? null,
        reminder_offset_minutes: t.reminder_offset_minutes ?? null,
        assigned_to_user_id: t.assigned_to_user_id ?? null,
      },
    });
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    const reminderVal = form.reminder_offset_minutes === ''
      ? null
      : parseInt(form.reminder_offset_minutes, 10);
    const data: Partial<TradeShowTodo> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      due_time: form.due_time || null,
      reminder_offset_minutes: reminderVal,
      assigned_to_user_id: form.assigned_to_user_id ? parseInt(form.assigned_to_user_id) : null,
    };
    if (editing) {
      updateMutation.mutate({ todoId: editing.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const openTodos = todos.filter(t => t.status !== 'done');
  const doneTodos = todos.filter(t => t.status === 'done');

  const renderRow = (t: TradeShowTodo) => {
    const due = dueText(t);
    const state = dueState(t);
    const dueColor =
      state === 'overdue' ? '#dc2626'
      : state === 'soon' ? '#f59e0b'
      : '#475569';

    return (
      <div
        key={t.id}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '0.75rem',
          borderBottom: '1px solid #f3f4f6',
          opacity: t.status === 'done' ? 0.6 : 1,
        }}
      >
        <input
          type="checkbox"
          checked={t.status === 'done'}
          onChange={() => toggleDone(t)}
          style={{ marginTop: '0.25rem', cursor: 'pointer', width: '1.05rem', height: '1.05rem' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontWeight: 600,
                color: t.status === 'done' ? '#9ca3af' : '#1f2937',
                textDecoration: t.status === 'done' ? 'line-through' : 'none',
              }}
            >
              {t.title}
            </span>
            <span style={priorityBadge(t.priority)}>{t.priority}</span>
            {t.status === 'in_progress' && (
              <span className="badge badge-warning">In Progress</span>
            )}
          </div>

          {t.description && (
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>
              {t.description}
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            marginTop: '0.4rem',
            fontSize: '0.8rem',
            color: '#6b7280',
          }}>
            {due && (
              <span style={{ color: dueColor, fontWeight: state === 'overdue' ? 600 : 400 }}>
                📅 {due}
                {state === 'overdue' && ' (Overdue)'}
                {state === 'soon' && ' (Soon)'}
              </span>
            )}
            {t.assigned_to_name && <span>👤 {t.assigned_to_name}</span>}
            {t.reminder_offset_minutes !== null && t.reminder_offset_minutes !== undefined && t.status !== 'done' && (
              <span title={t.reminder_sent_at ? `Reminder sent ${fmtDate(t.reminder_sent_at)}` : 'Reminder pending'}>
                {t.reminder_sent_at ? '🔕' : '🔔'} {reminderLabel(t.reminder_offset_minutes)}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            onClick={() => openEdit(t)}
            title="Edit"
            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.95rem', padding: '4px 6px' }}
            onMouseEnter={(ev) => (ev.currentTarget.style.color = '#3b82f6')}
            onMouseLeave={(ev) => (ev.currentTarget.style.color = '#6b7280')}
          >
            ✏️
          </button>
          <button
            onClick={() => handleDelete(t)}
            title="Delete"
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.95rem', padding: '4px 6px' }}
            onMouseEnter={(ev) => (ev.currentTarget.style.color = '#ef4444')}
            onMouseLeave={(ev) => (ev.currentTarget.style.color = '#9ca3af')}
          >
            🗑️
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ ...sectionTitle, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
          Conference To-Dos ({openTodos.length} open{doneTodos.length > 0 ? ` · ${doneTodos.length} done` : ''})
        </h3>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Task</button>
      </div>

      {todos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#6b7280' }}>
          No tasks yet. Add a task to track conference prep work — assignees will get reminders before due dates.
        </div>
      ) : (
        <>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            {openTodos.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
                Nothing open. 🎉
              </div>
            ) : (
              openTodos.map(renderRow)
            )}
          </div>

          {doneTodos.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={() => setShowCompleted(s => !s)}
                style={{
                  background: 'none', border: 'none', color: '#6b7280',
                  cursor: 'pointer', fontSize: '0.85rem', padding: '0.25rem 0',
                }}
              >
                {showCompleted ? '▼' : '▶'} Show completed ({doneTodos.length})
              </button>
              {showCompleted && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', marginTop: '0.5rem' }}>
                  {doneTodos.map(renderRow)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            padding: '1rem',
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: 0, marginBottom: '1rem' }}>
              {editing ? 'Edit Task' : 'Add Task'}
            </h2>

            {error && (
              <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem', background: '#fee2e2', borderRadius: '6px', color: '#991b1b', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={submit}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Confirm booth shipment"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-input"
                    value={form.status}
                    onChange={(e) => setForm(f => ({ ...f, status: e.target.value as TradeShowTodoStatus }))}
                  >
                    {TODO_STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-input"
                    value={form.priority}
                    onChange={(e) => setForm(f => ({ ...f, priority: e.target.value as TradeShowTodoPriority }))}
                  >
                    {TODO_PRIORITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Time</label>
                  <input
                    className="form-input"
                    type="time"
                    value={form.due_time}
                    onChange={(e) => setForm(f => ({ ...f, due_time: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Reminder
                  <span style={{ ...labelStyle, display: 'inline', marginLeft: '0.5rem', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    (sent to assignee — or coordinator if unassigned)
                  </span>
                </label>
                <select
                  className="form-input"
                  value={form.reminder_offset_minutes}
                  onChange={(e) => setForm(f => ({ ...f, reminder_offset_minutes: e.target.value }))}
                  disabled={!form.due_date}
                >
                  {REMINDER_OFFSET_OPTIONS.map(opt => (
                    <option key={String(opt.value)} value={opt.value === null ? '' : String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {!form.due_date && (
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    Set a due date to enable reminders
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Assigned To</label>
                <SearchableSelect
                  options={[{ value: '', label: '— Unassigned —', searchText: 'unassigned' }, ...userOptions]}
                  value={form.assigned_to_user_id}
                  onChange={(v) => setForm(f => ({ ...f, assigned_to_user_id: v }))}
                  placeholder="-- Select an employee --"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={addMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addMutation.isPending || updateMutation.isPending}
                >
                  {(addMutation.isPending || updateMutation.isPending)
                    ? 'Saving…'
                    : editing ? 'Save Changes' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeShowTodosSection;
