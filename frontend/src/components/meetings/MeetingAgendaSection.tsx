import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, MeetingAgendaItem, MeetingActionItem, MeetingAttendee } from '../../services/meetings';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import { format } from 'date-fns';

interface Props {
  meetingId: number;
  agendaItems: MeetingAgendaItem[];
  actionItems: MeetingActionItem[];
  attendees: MeetingAttendee[];
  readonly?: boolean;
}

const ACTION_STATUSES = [
  { value: 'open',        label: 'Open',        color: '#f97316' },
  { value: 'ongoing',     label: 'Ongoing',     color: '#3b82f6' },
  { value: 'on_hold',     label: 'On Hold',     color: '#ec4899' },
  { value: 'closed',      label: 'Closed',      color: '#9ca3af' },
  { value: 'information', label: 'Information', color: '#0ea5e9' },
] as const;

const getStatusConfig = (status: string) =>
  ACTION_STATUSES.find(s => s.value === status) ||
  (status === 'in_progress' ? { value: 'in_progress', label: 'In Progress', color: '#3b82f6' } : ACTION_STATUSES[0]);

const formatShortDate = (d: string | null) => {
  if (!d) return null;
  try {
    const s = d.includes('T') ? d.split('T')[0] : d;
    return format(new Date(s + 'T00:00:00'), 'MMM d');
  } catch { return null; }
};

const StatusDropdown: React.FC<{
  status: string;
  onChange: (status: string) => void;
  disabled?: boolean;
}> = ({ status, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const config = getStatusConfig(status);

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={e => { e.stopPropagation(); if (!disabled) setOpen(o => !o); }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          width: 115, padding: '4px 8px', borderRadius: 4,
          border: '1px solid #e5e7eb', background: '#fff',
          cursor: disabled ? 'default' : 'pointer',
          fontSize: 12, color: '#374151', flexShrink: 0,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: config.color, flexShrink: 0 }} />
        {config.label}
        {!disabled && <KeyboardArrowDownIcon style={{ fontSize: 14, color: '#9ca3af', marginLeft: 'auto' }} />}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 300,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 160, overflow: 'hidden',
        }}>
          {ACTION_STATUSES.map(s => (
            <button
              key={s.value}
              onClick={e => { e.stopPropagation(); onChange(s.value); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 14px',
                border: 'none', cursor: 'pointer', fontSize: 13,
                color: '#374151', textAlign: 'left',
                background: s.value === status ? '#f8fafc' : '#fff',
                fontWeight: s.value === status ? 600 : 400,
              }}
              onMouseEnter={e => { if (s.value !== status) (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
              onMouseLeave={e => { if (s.value !== status) (e.currentTarget as HTMLElement).style.background = s.value === status ? '#f8fafc' : '#fff'; }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              {s.label}
              {s.value === status && <span style={{ marginLeft: 'auto', color: config.color, fontSize: 14 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MeetingAgendaSection: React.FC<Props> = ({ meetingId, agendaItems, actionItems, attendees, readonly }) => {
  const { toast, confirm } = useTitanFeedback();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [newTitle, setNewTitle] = useState('');
  const [addingItemFor, setAddingItemFor] = useState<number | null>(null);
  const [newActionDesc, setNewActionDesc] = useState('');

  // Drag state — agenda items
  const [dragAgendaFromIdx, setDragAgendaFromIdx] = useState<number | null>(null);
  const [dragAgendaOverIdx, setDragAgendaOverIdx] = useState<number | null>(null);

  // Drag state — action items
  const [dragAction, setDragAction] = useState<{ sectionId: number | null; fromIdx: number } | null>(null);
  const [dragOverAction, setDragOverAction] = useState<{ sectionId: number | null; toIdx: number } | null>(null);

  // Agenda mutations
  const addAgendaMutation = useMutation({
    mutationFn: (title: string) => meetingsApi.addAgendaItem(meetingId, { title }),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to add agenda item.'),
  });

  const updateAgendaMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MeetingAgendaItem> }) =>
      meetingsApi.updateAgendaItem(meetingId, id, data),
    onSuccess: invalidate,
  });

  const deleteAgendaMutation = useMutation({
    mutationFn: (id: number) => meetingsApi.deleteAgendaItem(meetingId, id),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to delete agenda item.'),
  });

  const reorderAgendaMutation = useMutation({
    mutationFn: (orderedIds: number[]) => meetingsApi.reorderAgendaItems(meetingId, orderedIds),
    onSuccess: invalidate,
  });

  const reorderActionsMutation = useMutation({
    mutationFn: (orderedIds: number[]) => meetingsApi.reorderActionItems(meetingId, orderedIds),
    onSuccess: invalidate,
  });

  // Action item mutations
  const addActionMutation = useMutation({
    mutationFn: ({ agendaItemId, description }: { agendaItemId: number; description: string }) =>
      meetingsApi.addActionItem(meetingId, {
        description,
        agenda_item_id: agendaItemId,
        status: 'open' as any,
      }),
    onSuccess: () => { invalidate(); setAddingItemFor(null); setNewActionDesc(''); },
    onError: () => toast.error('Failed to add action item.'),
  });

  const updateActionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<MeetingActionItem> }) =>
      meetingsApi.updateActionItem(meetingId, id, data),
    onSuccess: () => { invalidate(); },
    onError: () => toast.error('Failed to update action item.'),
  });

  const deleteActionMutation = useMutation({
    mutationFn: (id: number) => meetingsApi.deleteActionItem(meetingId, id),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to delete action item.'),
  });

  const debounceUpdate = (id: number, data: Partial<MeetingAgendaItem>) => {
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => updateAgendaMutation.mutate({ id, data }), 600);
  };

  const toggleCollapsed = (id: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const attendeeNames = useMemo(() =>
    attendees.map(a =>
      (a.user_name || a.contact_name || a.name || '').trim().replace(/\s+/g, ' ')
    ).filter(Boolean),
    [attendees]
  );

  const actionsByAgenda = useMemo(() => {
    const map = new Map<number | null, MeetingActionItem[]>();
    actionItems.forEach(ai => {
      const key = ai.agenda_item_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ai);
    });
    return map;
  }, [actionItems]);

  const unlinkedActions = actionsByAgenda.get(null) || [];

  const handleAgendaDrop = (toIdx: number) => {
    if (dragAgendaFromIdx !== null && dragAgendaFromIdx !== toIdx) {
      const items = [...agendaItems];
      const [moved] = items.splice(dragAgendaFromIdx, 1);
      items.splice(toIdx, 0, moved);
      reorderAgendaMutation.mutate(items.map(i => i.id));
    }
    setDragAgendaFromIdx(null);
    setDragAgendaOverIdx(null);
  };

  const handleActionDrop = (sectionId: number | null, toIdx: number, sectionItems: MeetingActionItem[]) => {
    if (dragAction && dragAction.sectionId === sectionId && dragAction.fromIdx !== toIdx) {
      const acts = [...sectionItems];
      const [moved] = acts.splice(dragAction.fromIdx, 1);
      acts.splice(toIdx, 0, moved);
      reorderActionsMutation.mutate(acts.map(a => a.id));
    }
    setDragAction(null);
    setDragOverAction(null);
  };

  if (agendaItems.length === 0 && readonly) {
    return <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>No agenda items.</p>;
  }

  return (
    <div>
      {agendaItems.map((item, index) => {
        const isCollapsed = collapsed.has(item.id);
        const itemActions = actionsByAgenda.get(item.id) || [];
        const openCount = itemActions.filter(a => a.status !== 'closed').length;
        const isAgendaDragTarget =
          dragAgendaOverIdx === index &&
          dragAgendaFromIdx !== null &&
          dragAgendaFromIdx !== index;

        return (
          <div
            key={item.id}
            style={{
              borderBottom: '1px solid #f3f4f6',
              borderTop: isAgendaDragTarget ? '2px solid #1e3a5f' : '2px solid transparent',
              transition: 'border-top-color 0.1s',
            }}
            onDragOver={e => {
              if (dragAgendaFromIdx !== null) {
                e.preventDefault();
                e.stopPropagation();
                setDragAgendaOverIdx(index);
              }
            }}
            onDragLeave={e => {
              if (dragAgendaFromIdx !== null && !e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragAgendaOverIdx(null);
              }
            }}
            onDrop={e => {
              if (dragAgendaFromIdx !== null) {
                e.preventDefault();
                e.stopPropagation();
                handleAgendaDrop(index);
              }
            }}
          >
            {/* Agenda item header row */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', cursor: 'pointer' }}
              onClick={() => toggleCollapsed(item.id)}
            >
              {!readonly && (
                <span
                  draggable
                  onDragStart={e => { e.stopPropagation(); setDragAgendaFromIdx(index); }}
                  onDragEnd={() => { setDragAgendaFromIdx(null); setDragAgendaOverIdx(null); }}
                  onClick={e => e.stopPropagation()}
                  style={{ cursor: 'grab', color: '#d1d5db', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                >
                  <DragIndicatorIcon style={{ fontSize: 16 }} />
                </span>
              )}

              <button
                className="btn-icon"
                style={{ flexShrink: 0, color: '#6b7280' }}
                onClick={e => { e.stopPropagation(); toggleCollapsed(item.id); }}
              >
                {isCollapsed
                  ? <ChevronRightIcon style={{ fontSize: 18 }} />
                  : <ExpandMoreIcon style={{ fontSize: 18 }} />}
              </button>

              <div className="agenda-item-number">{index + 1}</div>

              {readonly ? (
                <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', flex: 1 }}>{item.title}</span>
              ) : (
                <input
                  className="agenda-item-title-input"
                  style={{ flex: 1 }}
                  defaultValue={item.title}
                  placeholder="Agenda item title"
                  onClick={e => e.stopPropagation()}
                  onBlur={e => {
                    if (e.target.value !== item.title) debounceUpdate(item.id, { title: e.target.value });
                  }}
                />
              )}

              {itemActions.length > 0 && (
                <span style={{ fontSize: 12, color: openCount > 0 ? '#f59e0b' : '#9ca3af', flexShrink: 0, fontWeight: openCount > 0 ? 600 : 400 }}>
                  {openCount > 0 ? `${openCount} open` : `${itemActions.length} items`}
                </span>
              )}

              {!readonly && (
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button
                    className="btn-icon btn-icon-danger"
                    title="Delete"
                    onClick={async () => {
                      const ok = await confirm({ title: 'Delete Agenda Item?', message: 'Action items in this section will become unlinked.', confirmText: 'Delete', danger: true });
                      if (ok) deleteAgendaMutation.mutate(item.id);
                    }}>
                    <DeleteIcon style={{ fontSize: 14 }} />
                  </button>
                </div>
              )}
            </div>

            {/* Expanded body */}
            {!isCollapsed && (
              <div style={{ paddingLeft: 56, paddingBottom: 16 }}>
                {/* Notes */}
                {!readonly ? (
                  <textarea
                    className="agenda-item-notes"
                    defaultValue={item.notes || ''}
                    rows={2}
                    placeholder="Notes / discussion…"
                    onBlur={e => debounceUpdate(item.id, { notes: e.target.value || null })}
                    style={{ marginBottom: itemActions.length > 0 ? 12 : 4 }}
                  />
                ) : item.notes ? (
                  <p style={{ fontSize: 13, color: '#374151', margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>{item.notes}</p>
                ) : null}

                {/* Action items header */}
                {(itemActions.length > 0 || (!readonly && addingItemFor !== item.id)) && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    paddingTop: 10, marginBottom: 2,
                    borderTop: '1px solid #f3f4f6',
                  }}>
                    {!readonly && <span style={{ width: 22, flexShrink: 0 }} />}
                    <span style={{ width: 22, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>
                      Action Items {itemActions.length > 0 ? `(${itemActions.length})` : ''}
                    </span>
                    {itemActions.length > 0 && !readonly && (
                      <span style={{ fontSize: 11, color: '#9ca3af', width: 160, flexShrink: 0 }}>Assignee</span>
                    )}
                    {itemActions.length > 0 && !readonly && (
                      <span style={{ fontSize: 11, color: '#9ca3af', width: 130, flexShrink: 0 }}>Due Date</span>
                    )}
                    {itemActions.length > 0 && (
                      <span style={{ fontSize: 11, color: '#9ca3af', width: 115, flexShrink: 0 }}>Status</span>
                    )}
                    {itemActions.length > 0 && !readonly && <span style={{ width: 28, flexShrink: 0 }} />}
                  </div>
                )}

                {/* Action items nested in this section */}
                {itemActions.map((ai, aiIdx) => {
                  const isActionTarget =
                    dragOverAction?.sectionId === item.id &&
                    dragOverAction?.toIdx === aiIdx &&
                    dragAction?.sectionId === item.id &&
                    dragAction?.fromIdx !== aiIdx;

                  return (
                    <div
                      key={ai.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                        borderTop: isActionTarget ? '2px solid #1e3a5f' : '2px solid transparent',
                        transition: 'border-top-color 0.1s',
                      }}
                      onDragOver={e => {
                        if (dragAction?.sectionId === item.id) {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverAction({ sectionId: item.id, toIdx: aiIdx });
                        }
                      }}
                      onDragLeave={() => {
                        if (dragAction?.sectionId === item.id) setDragOverAction(null);
                      }}
                      onDrop={e => {
                        if (dragAction?.sectionId === item.id) {
                          e.preventDefault();
                          e.stopPropagation();
                          handleActionDrop(item.id, aiIdx, itemActions);
                        }
                      }}
                    >
                      {!readonly && (
                        <span
                          draggable
                          onDragStart={e => { e.stopPropagation(); setDragAction({ sectionId: item.id, fromIdx: aiIdx }); }}
                          onDragEnd={() => { setDragAction(null); setDragOverAction(null); }}
                          style={{ cursor: 'grab', color: '#d1d5db', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        >
                          <DragIndicatorIcon style={{ fontSize: 14 }} />
                        </span>
                      )}

                      <span style={{ color: '#9ca3af', fontSize: 13, width: 22, flexShrink: 0, textAlign: 'right' }}>
                        {aiIdx + 1}.
                      </span>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        {!readonly ? (
                          <input
                            key={`desc-${ai.id}`}
                            style={{
                              flex: 1, fontSize: 13, padding: '2px 4px', minWidth: 0,
                              border: '1px solid transparent', borderRadius: 4,
                              color: '#374151', background: 'transparent',
                            }}
                            defaultValue={ai.description}
                            onFocus={e => { (e.currentTarget as HTMLInputElement).style.borderColor = '#e5e7eb'; }}
                            onBlur={e => {
                              (e.currentTarget as HTMLInputElement).style.borderColor = 'transparent';
                              const val = e.target.value.trim();
                              if (val && val !== ai.description) {
                                updateActionMutation.mutate({ id: ai.id, data: { description: val } });
                              }
                            }}
                          />
                        ) : (
                          <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>{ai.description}</span>
                        )}
                        {ai.originated_meeting_id && ai.originated_meeting_id !== meetingId && (
                          <span className="carried-badge" style={{ flexShrink: 0 }}>
                            From #{ai.originated_meeting_number}
                          </span>
                        )}
                      </div>

                      {!readonly ? (
                        <>
                          <input
                            key={`asgn-${ai.id}`}
                            style={{
                              width: 160, fontSize: 12, padding: '4px 8px',
                              border: '1px solid #e5e7eb', borderRadius: 4,
                              color: '#6b7280', background: '#fff', flexShrink: 0,
                            }}
                            placeholder="Assignee"
                            defaultValue={ai.assignee_user_name || ai.assignee_name || ''}
                            list={`attendees-${ai.id}`}
                            onBlur={e => {
                              const val = e.target.value.trim() || null;
                              if (val !== (ai.assignee_user_name || ai.assignee_name || null)) {
                                updateActionMutation.mutate({ id: ai.id, data: { assignee_name: val, assignee_id: null } });
                              }
                            }}
                          />
                          <datalist id={`attendees-${ai.id}`}>
                            {attendeeNames.map(n => <option key={n} value={n} />)}
                          </datalist>

                          <input
                            key={`date-${ai.id}`}
                            type="date"
                            style={{
                              width: 130, fontSize: 12, padding: '4px 8px',
                              border: '1px solid #e5e7eb', borderRadius: 4,
                              color: ai.due_date ? '#6b7280' : '#9ca3af', background: '#fff', flexShrink: 0,
                            }}
                            defaultValue={ai.due_date || ''}
                            onBlur={e => {
                              const val = e.target.value || null;
                              if (val !== (ai.due_date || null)) {
                                updateActionMutation.mutate({ id: ai.id, data: { due_date: val } });
                              }
                            }}
                          />
                        </>
                      ) : (
                        <>
                          {(ai.assignee_user_name || ai.assignee_name) && (
                            <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>
                              {ai.assignee_user_name || ai.assignee_name}
                            </span>
                          )}
                          {ai.due_date && (
                            <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>
                              {formatShortDate(ai.due_date)}
                            </span>
                          )}
                        </>
                      )}

                      <StatusDropdown
                        status={ai.status}
                        onChange={s => updateActionMutation.mutate({ id: ai.id, data: { status: s as any } })}
                        disabled={readonly}
                      />
                      {!readonly && (
                        <button className="btn-icon btn-icon-danger" title="Delete"
                          onClick={async () => {
                            const ok = await confirm({ title: 'Delete Action Item?', message: 'This cannot be undone.', confirmText: 'Delete', danger: true });
                            if (ok) deleteActionMutation.mutate(ai.id);
                          }}>
                          <DeleteIcon style={{ fontSize: 14 }} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Inline add */}
                {!readonly && (
                  addingItemFor === item.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                      <input
                        className="form-input"
                        style={{ flex: 1, fontSize: 13 }}
                        placeholder="Enter action item…"
                        value={newActionDesc}
                        onChange={e => setNewActionDesc(e.target.value)}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newActionDesc.trim()) {
                            addActionMutation.mutate({ agendaItemId: item.id, description: newActionDesc.trim() });
                          }
                          if (e.key === 'Escape') { setAddingItemFor(null); setNewActionDesc(''); }
                        }}
                      />
                      <button
                        className="sales-btn sales-btn-primary"
                        style={{ flexShrink: 0 }}
                        onClick={() => { if (newActionDesc.trim()) addActionMutation.mutate({ agendaItemId: item.id, description: newActionDesc.trim() }); }}
                        disabled={!newActionDesc.trim() || addActionMutation.isPending}
                      >
                        Add
                      </button>
                      <button
                        className="sales-btn sales-btn-secondary"
                        style={{ flexShrink: 0 }}
                        onClick={() => { setAddingItemFor(null); setNewActionDesc(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="add-item-row"
                      style={{ marginTop: 6 }}
                      onClick={e => { e.stopPropagation(); setAddingItemFor(item.id); setNewActionDesc(''); }}
                    >
                      <AddIcon style={{ fontSize: 14 }} /> Add item
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Unlinked action items */}
      {unlinkedActions.length > 0 && (
        <div style={{ marginTop: 20, paddingTop: 12, borderTop: '2px solid #e5e7eb' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Unlinked Action Items
          </div>
          {unlinkedActions.map((ai, idx) => (
            <div key={ai.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ color: '#9ca3af', fontSize: 13, width: 22, textAlign: 'right', flexShrink: 0 }}>{idx + 1}.</span>
              <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>{ai.description}</span>
              <StatusDropdown
                status={ai.status}
                onChange={s => updateActionMutation.mutate({ id: ai.id, data: { status: s as any } })}
                disabled={readonly}
              />
              {!readonly && (
                <button className="btn-icon btn-icon-danger" title="Delete"
                  onClick={async () => {
                    const ok = await confirm({ title: 'Delete Action Item?', message: 'This cannot be undone.', confirmText: 'Delete', danger: true });
                    if (ok) deleteActionMutation.mutate(ai.id);
                  }}>
                  <DeleteIcon style={{ fontSize: 14 }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new agenda item */}
      {!readonly && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input
            className="form-input"
            placeholder="Add agenda item…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newTitle.trim()) {
                addAgendaMutation.mutate(newTitle.trim());
                setNewTitle('');
              }
            }}
            style={{ flex: 1 }}
          />
          <button
            className="sales-btn sales-btn-secondary"
            onClick={() => { if (newTitle.trim()) { addAgendaMutation.mutate(newTitle.trim()); setNewTitle(''); } }}
            disabled={!newTitle.trim() || addAgendaMutation.isPending}
          >
            <AddIcon style={{ fontSize: 16 }} /> Add
          </button>
        </div>
      )}
    </div>
  );
};

export default MeetingAgendaSection;
