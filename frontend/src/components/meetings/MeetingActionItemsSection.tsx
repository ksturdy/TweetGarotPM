import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, MeetingActionItem, MeetingAgendaItem, MeetingAttendee } from '../../services/meetings';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import SearchableSelect from '../SearchableSelect';
import { format, parseISO } from 'date-fns';

interface Props {
  meetingId: number;
  actionItems: MeetingActionItem[];
  agendaItems: MeetingAgendaItem[];
  attendees: MeetingAttendee[];
  readonly?: boolean;
}

const STATUS_SEQUENCE: MeetingActionItem['status'][] = ['open', 'in_progress', 'closed'];

const statusClass = (s: string) => {
  if (s === 'open') return 'action-status-chip action-status-open';
  if (s === 'in_progress') return 'action-status-chip action-status-in_progress';
  return 'action-status-chip action-status-closed';
};

const statusLabel = (s: string) => s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);

const formatDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; }
};

interface ItemForm {
  description: string;
  agenda_item_id: string;
  assignee_value: string;  // "u:123" for user, "n:Name" for freetext
  due_date: string;
  status: string;
}

const emptyForm = (): ItemForm => ({
  description: '', agenda_item_id: '', assignee_value: '', due_date: '', status: 'open',
});

const decodeAssignee = (val: string) => {
  if (!val) return { assignee_id: undefined, assignee_name: undefined };
  if (val.startsWith('u:')) return { assignee_id: Number(val.slice(2)), assignee_name: undefined };
  return { assignee_id: undefined, assignee_name: val.slice(2) || undefined };
};

const encodeAssignee = (assignee_id: number | null, assignee_name: string | null) => {
  if (assignee_id) return `u:${assignee_id}`;
  if (assignee_name) return `n:${assignee_name}`;
  return '';
};

const MeetingActionItemsSection: React.FC<Props> = ({ meetingId, actionItems, agendaItems, attendees, readonly }) => {
  const { toast, confirm } = useTitanFeedback();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });

  const [formMode, setFormMode] = useState<'none' | 'add' | 'edit'>('none');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm());

  const attendeeOptions = attendees.map(a => {
    const label = (a.user_name || a.contact_name || a.name || 'Unknown').trim().replace(/\s+/g, ' ');
    return a.user_id
      ? { value: `u:${a.user_id}`, label }
      : { value: `n:${label}`, label };
  });

  const agendaOptions = agendaItems.map((ag, i) => ({
    value: String(ag.id),
    label: `${i + 1}. ${ag.title}`,
  }));

  const addMutation = useMutation({
    mutationFn: () => {
      const { assignee_id, assignee_name } = decodeAssignee(form.assignee_value);
      return meetingsApi.addActionItem(meetingId, {
        description: form.description,
        agenda_item_id: form.agenda_item_id ? Number(form.agenda_item_id) : undefined,
        assignee_id,
        assignee_name,
        due_date: form.due_date || undefined,
        status: form.status as any,
      });
    },
    onSuccess: () => { invalidate(); cancelForm(); toast.success('Action item added.'); },
    onError: () => toast.error('Failed to add action item.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MeetingActionItem> }) =>
      meetingsApi.updateActionItem(meetingId, id, data),
    onSuccess: () => { invalidate(); cancelForm(); },
    onError: () => toast.error('Failed to update action item.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => meetingsApi.deleteActionItem(meetingId, id),
    onSuccess: () => { invalidate(); toast.success('Action item deleted.'); },
    onError: () => toast.error('Failed to delete action item.'),
  });

  const cycleStatus = (item: MeetingActionItem) => {
    if (readonly) return;
    const idx = STATUS_SEQUENCE.indexOf(item.status);
    const next = STATUS_SEQUENCE[(idx + 1) % STATUS_SEQUENCE.length];
    updateMutation.mutate({ id: item.id, data: { status: next } });
  };

  const startAdd = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormMode('add');
  };

  const startEdit = (item: MeetingActionItem) => {
    setEditingId(item.id);
    setForm({
      description: item.description,
      agenda_item_id: item.agenda_item_id ? String(item.agenda_item_id) : '',
      assignee_value: encodeAssignee(item.assignee_id, item.assignee_name),
      due_date: item.due_date || '',
      status: item.status,
    });
    setFormMode('edit');
  };

  const cancelForm = () => {
    setFormMode('none');
    setEditingId(null);
    setForm(emptyForm());
  };

  const saveForm = () => {
    if (!form.description.trim()) return;
    const { assignee_id, assignee_name } = decodeAssignee(form.assignee_value);
    const data = {
      description: form.description,
      agenda_item_id: form.agenda_item_id ? Number(form.agenda_item_id) : undefined,
      assignee_id,
      assignee_name,
      due_date: form.due_date || undefined,
      status: form.status as any,
    };
    if (formMode === 'edit' && editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      addMutation.mutate();
    }
  };

  const assigneeName = (item: MeetingActionItem) =>
    item.assignee_user_name || item.assignee_name || '—';

  if (actionItems.length === 0 && readonly) {
    return <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>No action items.</p>;
  }

  return (
    <div>
      <table className="action-items-table">
        <thead>
          <tr>
            <th style={{ width: '38%' }}>Description</th>
            <th>Agenda Item</th>
            <th>Assignee</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Source</th>
            {!readonly && <th style={{ width: 64 }}></th>}
          </tr>
        </thead>
        <tbody>
          {actionItems.length === 0 && (
            <tr>
              <td colSpan={readonly ? 6 : 7} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af', fontSize: 14 }}>
                No action items yet.
              </td>
            </tr>
          )}
          {actionItems.map(item => (
            <tr key={item.id} style={{ background: editingId === item.id ? '#eff6ff' : undefined }}>
              <td style={{ fontWeight: 500 }}>{item.description}</td>
              <td style={{ color: '#6b7280', fontSize: 13 }}>{item.agenda_item_title || '—'}</td>
              <td style={{ fontSize: 13 }}>{assigneeName(item)}</td>
              <td style={{ fontSize: 13, color: '#6b7280' }}>{formatDate(item.due_date)}</td>
              <td>
                <button
                  className={statusClass(item.status)}
                  onClick={() => cycleStatus(item)}
                  title={readonly ? undefined : 'Click to advance status'}
                  style={{ cursor: readonly ? 'default' : 'pointer' }}
                >
                  {statusLabel(item.status)}
                </button>
              </td>
              <td>
                {item.originated_meeting_id && item.originated_meeting_id !== meetingId && (
                  <span className="carried-badge">From #{item.originated_meeting_number}</span>
                )}
              </td>
              {!readonly && (
                <td style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon" title="Edit" onClick={() => startEdit(item)}>
                    <EditIcon style={{ fontSize: 15 }} />
                  </button>
                  <button className="btn-icon btn-icon-danger" title="Delete"
                    onClick={async () => {
                      const ok = await confirm({ title: 'Delete Action Item?', message: 'This cannot be undone.', confirmText: 'Delete', danger: true });
                      if (ok) deleteMutation.mutate(item.id);
                    }}>
                    <DeleteIcon style={{ fontSize: 15 }} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add / Edit form panel */}
      {formMode !== 'none' && (
        <div style={{ margin: '12px 16px 8px', padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 12 }}>
            {formMode === 'edit' ? 'Edit Action Item' : 'New Action Item'}
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Description *</label>
            <input
              className="form-input"
              placeholder="Describe the action required…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              autoFocus
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px 140px', gap: 12, marginBottom: 12 }}>
            <div className="form-group">
              <label className="form-label">Agenda Item</label>
              <SearchableSelect
                options={agendaOptions}
                value={form.agenda_item_id}
                onChange={v => setForm(f => ({ ...f, agenda_item_id: v }))}
                placeholder="— None —"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Assignee</label>
              <SearchableSelect
                options={attendeeOptions}
                value={form.assignee_value}
                onChange={v => setForm(f => ({ ...f, assignee_value: v }))}
                placeholder="— None —"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
                className="form-input"
                type="date"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="sales-btn sales-btn-secondary" onClick={cancelForm}>Cancel</button>
            <button
              className="sales-btn sales-btn-primary"
              onClick={saveForm}
              disabled={!form.description.trim() || addMutation.isPending || updateMutation.isPending}
            >
              {addMutation.isPending || updateMutation.isPending ? 'Saving…' : formMode === 'edit' ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </div>
      )}

      {!readonly && formMode === 'none' && (
        <button className="add-item-row" style={{ margin: '8px 16px' }} onClick={startAdd}>
          <AddIcon style={{ fontSize: 16 }} /> Add Action Item
        </button>
      )}
    </div>
  );
};

export default MeetingActionItemsSection;
