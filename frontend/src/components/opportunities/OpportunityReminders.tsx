import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import DeleteIcon from '@mui/icons-material/Delete';
import opportunitiesService from '../../services/opportunities';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

const RECURRENCE_OPTIONS = [
  { label: 'No repeat', value: null },
  { label: 'Weekly', value: 7 },
  { label: 'Every 2 weeks', value: 14 },
  { label: 'Monthly', value: 30 },
  { label: 'Every 3 months', value: 90 },
  { label: 'Every 6 months', value: 180 },
];

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRemindAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function defaultDatetime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

interface Props {
  opportunityId: number;
}

const OpportunityReminders: React.FC<Props> = ({ opportunityId }) => {
  const queryClient = useQueryClient();
  const { toast } = useTitanFeedback();
  const [showForm, setShowForm] = useState(false);
  const [remindAt, setRemindAt] = useState(defaultDatetime());
  const [note, setNote] = useState('');
  const [recurrenceDays, setRecurrenceDays] = useState<number | null>(null);

  const { data: reminders = [] } = useQuery({
    queryKey: ['opportunities', opportunityId, 'reminders'],
    queryFn: () => opportunitiesService.getReminders(opportunityId),
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: () => opportunitiesService.createReminder(opportunityId, {
      remind_at: new Date(remindAt).toISOString(),
      note: note.trim() || undefined,
      recurrence_days: recurrenceDays,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', opportunityId, 'reminders'] });
      setShowForm(false);
      setRemindAt(defaultDatetime());
      setNote('');
      setRecurrenceDays(null);
      toast.success('Reminder set');
    },
    onError: () => toast.error('Failed to set reminder'),
  });

  const deleteMutation = useMutation({
    mutationFn: (reminderId: number) =>
      opportunitiesService.deleteReminder(opportunityId, reminderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities', opportunityId, 'reminders'] });
      toast.success('Reminder cancelled');
    },
    onError: () => toast.error('Failed to cancel reminder'),
  });

  const pending = reminders.filter(r => !r.fired_at);
  const fired = reminders.filter(r => r.fired_at);

  return (
    <div style={{ padding: '0.75rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <NotificationsNoneIcon style={{ fontSize: '1rem' }} />
          Reminders
        </span>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{ fontSize: '0.78rem', color: '#002356', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}
          >
            + Set reminder
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 2 }}>Date &amp; time</label>
              <input
                type="datetime-local"
                value={remindAt}
                onChange={e => setRemindAt(e.target.value)}
                style={{ fontSize: '0.82rem', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 2 }}>Note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Follow up on proposal"
                style={{ fontSize: '0.82rem', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 2 }}>Repeat</label>
              <select
                value={recurrenceDays ?? ''}
                onChange={e => setRecurrenceDays(e.target.value === '' ? null : Number(e.target.value))}
                style={{ fontSize: '0.82rem', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box' }}
              >
                {RECURRENCE_OPTIONS.map(opt => (
                  <option key={String(opt.value)} value={opt.value ?? ''}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ fontSize: '0.8rem', padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!remindAt || createMutation.isPending}
                style={{ fontSize: '0.8rem', padding: '4px 12px', border: 'none', borderRadius: 4, background: '#002356', color: 'white', cursor: 'pointer', fontWeight: 600 }}
              >
                {createMutation.isPending ? 'Saving...' : 'Set Reminder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pending.length === 0 && !showForm && (
        <div style={{ fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic' }}>No reminders set</div>
      )}

      {pending.map(r => {
        const recurrenceLabel = RECURRENCE_OPTIONS.find(o => o.value === r.recurrence_days)?.label;
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6' }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827' }}>
                {formatRemindAt(r.remind_at)}
              </div>
              {r.note && <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{r.note}</div>}
              {r.recurrence_days && (
                <div style={{ fontSize: '0.73rem', color: '#9ca3af' }}>↻ {recurrenceLabel}</div>
              )}
            </div>
            <button
              onClick={() => deleteMutation.mutate(r.id)}
              disabled={deleteMutation.isPending}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px 4px', flexShrink: 0 }}
              title="Cancel reminder"
            >
              <DeleteIcon style={{ fontSize: '0.9rem' }} />
            </button>
          </div>
        );
      })}

      {fired.length > 0 && (
        <details style={{ marginTop: '0.5rem' }}>
          <summary style={{ fontSize: '0.73rem', color: '#9ca3af', cursor: 'pointer' }}>
            {fired.length} past reminder{fired.length !== 1 ? 's' : ''}
          </summary>
          {fired.map(r => (
            <div key={r.id} style={{ padding: '0.3rem 0', borderBottom: '1px solid #f3f4f6', opacity: 0.5 }}>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', textDecoration: 'line-through' }}>
                {formatRemindAt(r.remind_at)}
              </div>
              {r.note && <div style={{ fontSize: '0.73rem', color: '#9ca3af' }}>{r.note}</div>}
            </div>
          ))}
        </details>
      )}
    </div>
  );
};

export default OpportunityReminders;
