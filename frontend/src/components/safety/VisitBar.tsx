import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { format, addDays, parseISO } from 'date-fns';
import type { SafetyVisit } from '../../services/safetyVisits';

export const LANE_H = 28;
export const BAR_H = 22;

interface Props {
  visit: SafetyVisit;
  startDay: number;      // 0–6 offset within the week row
  spanDays: number;      // 1–7
  lane: number;
  weekStart: Date;
  isLastSegment: boolean;
  gridRef: React.RefObject<HTMLDivElement | null>;
  onClick: (visit: SafetyVisit) => void;
  onResize: (visitId: number, newEndDate: string) => void;
  onDelete: (visitId: number) => void;
  memberColor?: string;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  proposed:  { bg: '#f3f4f6', border: '#d1d5db', color: '#374151' },
  confirmed: { bg: '#dbeafe', border: '#93c5fd', color: '#1d4ed8' },
  completed: { bg: '#d1fae5', border: '#6ee7b7', color: '#065f46' },
  cancelled: { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b' },
};

const TYPE_LABEL: Record<string, string> = { kickoff: 'K', routine: 'R', follow_up: 'F' };

function getCityState(address?: string | null): string {
  if (!address) return '';
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 3) {
    const city = parts[parts.length - 2];
    const state = parts[parts.length - 1].split(/\s+/)[0];
    return `${city}, ${state}`;
  }
  return parts.length >= 2 ? parts[parts.length - 1] : '';
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const VisitBar: React.FC<Props> = ({
  visit, startDay, spanDays, lane, weekStart, isLastSegment, gridRef, onClick, onResize, onDelete, memberColor,
}) => {
  const [resizingSpan, setResizingSpan] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);

  const isDraggable = visit.status !== 'completed' && visit.status !== 'cancelled';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `visit-${visit.id}`,
    data: { visit, weekStart },
    disabled: !isDraggable,
  });

  const displaySpan = resizingSpan ?? spanDays;
  const statusStyle = STATUS_COLORS[visit.status] ?? STATUS_COLORS.proposed;

  const barBg     = memberColor ? hexToRgba(memberColor, 0.15) : statusStyle.bg;
  const barBorder = memberColor ?? statusStyle.border;
  const barColor  = memberColor ?? statusStyle.color;

  const assigneeInitials = visit.assigned_to_name
    ? visit.assigned_to_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : null;

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const origSpan = spanDays;

    const getDayWidth = () => {
      if (!gridRef.current) return 80;
      return gridRef.current.clientWidth / 7;
    };

    const onMove = (me: PointerEvent) => {
      const dw = getDayWidth();
      const delta = Math.round((me.clientX - startX) / dw);
      setResizingSpan(Math.max(1, Math.min(7 - startDay, origSpan + delta)));
    };

    const onUp = (me: PointerEvent) => {
      const dw = getDayWidth();
      const delta = Math.round((me.clientX - startX) / dw);
      const newSpan = Math.max(1, Math.min(7 - startDay, origSpan + delta));
      const newEndDate = format(addDays(weekStart, startDay + newSpan - 1), 'yyyy-MM-dd');
      onResize(visit.id, newEndDate);
      setResizingSpan(null);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const leftPct = (startDay / 7) * 100;
  const widthPct = (displaySpan / 7) * 100;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick(visit); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: `calc(${leftPct}% + 1px)`,
        width: `calc(${widthPct}% - 2px)`,
        top: `${lane * LANE_H + 3}px`,
        height: `${BAR_H}px`,
        background: barBg,
        border: `1px solid ${barBorder}`,
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '0 4px',
        overflow: 'hidden',
        fontSize: '10px',
        fontWeight: 600,
        color: barColor,
        cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
        opacity: isDragging ? 0.3 : 1,
        userSelect: 'none',
        zIndex: 2,
        boxSizing: 'border-box',
        transition: isDragging ? 'none' : 'opacity 0.1s',
      }}
      title={`${visit.project_name ?? ''}${getCityState(visit.project_address) ? ' · ' + getCityState(visit.project_address) : ''} — ${visit.visit_type.replace('_', ' ')}${visit.assigned_to_name ? ' (' + visit.assigned_to_name + ')' : ''}${visit.is_out_of_state ? ' ✈' : ''}`}
    >
      {/* Assignee / type badge */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
        background: barColor, color: barBg || '#fff', fontSize: '7px', fontWeight: 800,
      }}>
        {assigneeInitials ?? (TYPE_LABEL[visit.visit_type] ?? 'V')}
      </span>

      {/* Label */}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {visit.project_name ?? `Visit #${visit.number}`}
        {getCityState(visit.project_address) && (
          <span style={{ opacity: 0.65, fontWeight: 400 }}> · {getCityState(visit.project_address)}</span>
        )}
      </span>
      {visit.is_out_of_state && <span style={{ flexShrink: 0 }} title="Out of state">✈</span>}
      {visit.status === 'completed' && <span style={{ flexShrink: 0 }}>✓</span>}

      {/* Delete button — shown on hover */}
      {hovered && !isDragging && (
        <div
          onPointerDown={e => { e.stopPropagation(); e.preventDefault(); }}
          onClick={(e) => { e.stopPropagation(); onDelete(visit.id); }}
          style={{
            flexShrink: 0,
            width: '14px',
            height: '14px',
            borderRadius: '3px',
            background: 'rgba(220,38,38,0.15)',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            lineHeight: 1,
            marginRight: isLastSegment && isDraggable ? '6px' : '0',
          }}
          title="Delete visit"
        >
          ×
        </div>
      )}

      {/* Resize handle */}
      {isLastSegment && isDraggable && (
        <div
          onPointerDown={handleResizePointerDown}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: '8px',
            cursor: 'ew-resize',
            background: 'transparent',
          }}
          title="Drag to extend visit"
        />
      )}
    </div>
  );
};

VisitBar.displayName = 'VisitBar';
