import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { SafetyVisit } from '../../services/safetyVisits';

interface Props {
  visit: SafetyVisit;
  onClick: (visit: SafetyVisit) => void;
}

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  proposed:  { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  confirmed: { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  completed: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  cancelled: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};

const TYPE_LABEL: Record<string, string> = {
  kickoff:   'K',
  routine:   'R',
  follow_up: 'F',
};

export const VisitChip: React.FC<Props> = ({ visit, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `visit-${visit.id}`,
    data: { visit },
    disabled: visit.status === 'completed' || visit.status === 'cancelled',
  });

  const style = STATUS_STYLES[visit.status] ?? STATUS_STYLES.proposed;

  const chipStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 6px',
    borderRadius: '6px',
    border: `1px solid ${style.border}`,
    background: style.bg,
    color: style.color,
    fontSize: '11px',
    fontWeight: 600,
    cursor: visit.status === 'completed' || visit.status === 'cancelled' ? 'pointer' : 'grab',
    userSelect: 'none',
    maxWidth: '100%',
    overflow: 'hidden',
    opacity: isDragging ? 0.4 : 1,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    transition: isDragging ? 'none' : 'opacity 0.15s',
    whiteSpace: 'nowrap',
  };

  const initials = visit.assigned_to_name
    ? visit.assigned_to_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '—';

  return (
    <div
      ref={setNodeRef}
      style={chipStyle}
      title={`${visit.visit_type.replace('_', ' ')} visit${visit.assigned_to_name ? ' — ' + visit.assigned_to_name : ''}${visit.is_out_of_state ? ' ✈' : ''}`}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick(visit);
      }}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        background: style.color,
        color: style.bg,
        fontSize: '9px',
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {TYPE_LABEL[visit.visit_type] ?? 'V'}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{initials}</span>
      {visit.is_out_of_state && <span title="Out of state — travel required">✈</span>}
      {visit.status === 'completed' && <span>✓</span>}
    </div>
  );
};
