import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, MeetingAgendaItem } from '../../services/meetings';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

interface Props {
  meetingId: number;
  agendaItems: MeetingAgendaItem[];
  readonly?: boolean;
}

const MeetingAgendaSection: React.FC<Props> = ({ meetingId, agendaItems, readonly }) => {
  const { toast, confirm } = useTitanFeedback();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const addMutation = useMutation({
    mutationFn: (title: string) => meetingsApi.addAgendaItem(meetingId, { title }),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to add agenda item.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MeetingAgendaItem> }) =>
      meetingsApi.updateAgendaItem(meetingId, id, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => meetingsApi.deleteAgendaItem(meetingId, id),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to delete agenda item.'),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) => meetingsApi.reorderAgendaItems(meetingId, orderedIds),
    onSuccess: invalidate,
  });

  const debounceUpdate = (id: number, data: Partial<MeetingAgendaItem>) => {
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => {
      updateMutation.mutate({ id, data });
    }, 600);
  };

  const handleMove = (index: number, dir: -1 | 1) => {
    const items = [...agendaItems];
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    [items[index], items[swapIdx]] = [items[swapIdx], items[index]];
    reorderMutation.mutate(items.map(i => i.id));
  };

  const [newTitle, setNewTitle] = useState('');

  const handleAdd = () => {
    const t = newTitle.trim();
    if (!t) return;
    addMutation.mutate(t);
    setNewTitle('');
  };

  if (agendaItems.length === 0 && readonly) {
    return <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>No agenda items.</p>;
  }

  return (
    <div>
      {agendaItems.map((item, index) => (
        <div key={item.id} className="agenda-item-row">
          <div className="agenda-item-number">{index + 1}</div>
          <div className="agenda-item-content">
            {readonly ? (
              <>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 4 }}>{item.title}</div>
                {item.notes && <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{item.notes}</div>}
              </>
            ) : (
              <>
                <input
                  className="agenda-item-title-input"
                  defaultValue={item.title}
                  placeholder="Agenda item title"
                  onBlur={e => {
                    if (e.target.value !== item.title) debounceUpdate(item.id, { title: e.target.value });
                  }}
                />
                <textarea
                  className="agenda-item-notes"
                  defaultValue={item.notes || ''}
                  rows={2}
                  placeholder="Notes / discussion…"
                  onBlur={e => debounceUpdate(item.id, { notes: e.target.value || null })}
                />
              </>
            )}
          </div>
          {!readonly && (
            <div className="agenda-item-controls">
              <button className="btn-icon" title="Move up" onClick={() => handleMove(index, -1)} disabled={index === 0}>
                <ArrowUpwardIcon style={{ fontSize: 15 }} />
              </button>
              <button className="btn-icon" title="Move down" onClick={() => handleMove(index, 1)} disabled={index === agendaItems.length - 1}>
                <ArrowDownwardIcon style={{ fontSize: 15 }} />
              </button>
              <button className="btn-icon btn-icon-danger" title="Delete"
                onClick={async () => {
                  const ok = await confirm({ title: 'Delete Agenda Item?', message: 'This cannot be undone.', confirmText: 'Delete', danger: true });
                  if (ok) deleteMutation.mutate(item.id);
                }}>
                <DeleteIcon style={{ fontSize: 15 }} />
              </button>
            </div>
          )}
        </div>
      ))}

      {!readonly && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            className="form-input"
            placeholder="Add agenda item…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1 }}
          />
          <button className="sales-btn sales-btn-secondary" onClick={handleAdd} disabled={!newTitle.trim() || addMutation.isPending}>
            <AddIcon style={{ fontSize: 16 }} /> Add
          </button>
        </div>
      )}
    </div>
  );
};

export default MeetingAgendaSection;
