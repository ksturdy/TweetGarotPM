import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { format, startOfWeek, addWeeks, parseISO } from 'date-fns';
import { VisitChip } from './VisitChip';
import type { SafetyVisit, ProjectWithPriority } from '../../services/safetyVisits';

interface Props {
  windowStart: Date;
  projects: ProjectWithPriority[];
  visits: SafetyVisit[];
  onVisitClick: (visit: SafetyVisit) => void;
  onCellClick: (projectId: number, weekStart: Date) => void;
}

const WEEKS = 6;
const LEFT_WIDTH = 280;
const WEEK_WIDTH = 120;

function getPriorityBadge(p: ProjectWithPriority): { label: string; color: string; bg: string } {
  if (p.needs_kickoff) return { label: 'KICKOFF', color: '#dc2626', bg: '#fee2e2' };
  if (p.remaining_hours > 2000) return { label: 'HIGH', color: '#d97706', bg: '#fef3c7' };
  if (p.remaining_hours > 500) return { label: 'MED', color: '#2563eb', bg: '#dbeafe' };
  return { label: 'LOW', color: '#6b7280', bg: '#f3f4f6' };
}

function formatDaysAgo(days: number | null): string {
  if (days === null || days === undefined) return 'Never visited';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function isSameWeek(date: string | null, weekStart: Date): boolean {
  if (!date) return false;
  const d = parseISO(date);
  const weekEnd = addWeeks(weekStart, 1);
  return d >= weekStart && d < weekEnd;
}

// Wrapped in React.memo so it only re-renders when its own props change.
// This prevents all 150*6 = 900 useDroppable hooks from re-registering on every parent render.
const WeekCell = React.memo<{
  cellId: string;
  projectId: number;
  weekStart: Date;
  visits: SafetyVisit[];
  onVisitClick: (v: SafetyVisit) => void;
  onCellClick: (projectId: number, weekStart: Date) => void;
}>(({ cellId, projectId, weekStart, visits, onVisitClick, onCellClick }) => {
  const { isOver, setNodeRef } = useDroppable({ id: cellId, data: { projectId, weekStart } });

  return (
    <td
      ref={setNodeRef}
      onClick={() => onCellClick(projectId, weekStart)}
      style={{
        width: `${WEEK_WIDTH}px`,
        minWidth: `${WEEK_WIDTH}px`,
        padding: '4px 6px',
        verticalAlign: 'top',
        border: '1px solid #e5e7eb',
        background: isOver ? '#eff6ff' : '#fff',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minHeight: '32px' }}>
        {visits.map(v => (
          <VisitChip key={v.id} visit={v} onClick={onVisitClick} />
        ))}
      </div>
    </td>
  );
});

export const VisitPlannerGrid: React.FC<Props> = ({
  windowStart,
  projects,
  visits,
  onVisitClick,
  onCellClick,
}) => {
  const today = new Date();

  // Memoize weekStarts so they don't recreate a new array each render,
  // which would cause every WeekCell's useDroppable to re-register.
  const weekStarts = React.useMemo(
    () => Array.from({ length: WEEKS }, (_, i) => startOfWeek(addWeeks(windowStart, i), { weekStartsOn: 1 })),
    [windowStart]
  );

  // Keyed lookup: "projectId-weekDate" → visits in that cell
  const visitsByKey = React.useMemo(() => {
    const map: Record<string, SafetyVisit[]> = {};
    for (const v of visits) {
      for (const ws of weekStarts) {
        if (isSameWeek(v.scheduled_date, ws)) {
          const key = `${v.project_id}-${format(ws, 'yyyy-MM-dd')}`;
          if (!map[key]) map[key] = [];
          map[key].push(v);
        }
      }
    }
    return map;
  }, [visits, weekStarts]);

  if (projects.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
        No active projects found. Adjust filters to see projects.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${LEFT_WIDTH + WEEKS * WEEK_WIDTH}px` }}>
        <thead>
          <tr style={{ background: '#f9fafb' }}>
            <th style={{
              width: `${LEFT_WIDTH}px`,
              minWidth: `${LEFT_WIDTH}px`,
              padding: '8px 12px',
              textAlign: 'left',
              fontSize: '11px',
              fontWeight: 700,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              border: '1px solid #e5e7eb',
              position: 'sticky',
              top: 0,
              left: 0,
              background: '#f9fafb',
              zIndex: 3,
            }}>
              Project
            </th>
            {weekStarts.map(ws => {
              const isCurrentWeek = ws <= today && addWeeks(ws, 1) > today;
              return (
                <th key={ws.toISOString()} style={{
                  width: `${WEEK_WIDTH}px`,
                  minWidth: `${WEEK_WIDTH}px`,
                  padding: '8px 6px',
                  textAlign: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: isCurrentWeek ? '#002356' : '#6b7280',
                  border: '1px solid #e5e7eb',
                  background: isCurrentWeek ? '#eff6ff' : '#f9fafb',
                  whiteSpace: 'nowrap',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                }}>
                  <div>{format(ws, 'MMM d')}</div>
                  {isCurrentWeek && <div style={{ fontSize: '9px', color: '#2563eb', fontWeight: 400 }}>THIS WEEK</div>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {projects.map(p => {
            const badge = getPriorityBadge(p);
            return (
              <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{
                  width: `${LEFT_WIDTH}px`,
                  minWidth: `${LEFT_WIDTH}px`,
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderLeft: `3px solid ${badge.color}`,
                  position: 'sticky',
                  left: 0,
                  background: '#fff',
                  zIndex: 1,
                  verticalAlign: 'top',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '1px 7px',
                      borderRadius: '10px',
                      fontSize: '9px',
                      fontWeight: 800,
                      background: badge.bg,
                      color: badge.color,
                      flexShrink: 0,
                      marginTop: '1px',
                      letterSpacing: '0.03em',
                    }}>
                      {badge.label}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>#{p.number}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#9ca3af' }}>
                    <span title="Remaining labor hours">
                      ⏱ {p.remaining_hours > 0 ? `${Math.round(p.remaining_hours).toLocaleString()} hrs` : '—'}
                    </span>
                    <span title={p.last_visit_date ? `Last visit: ${p.last_visit_date}` : 'No prior visits'}>
                      👁 {formatDaysAgo(p.days_since_last_visit)}
                    </span>
                  </div>
                </td>
                {weekStarts.map(ws => {
                  const key = `${p.id}-${format(ws, 'yyyy-MM-dd')}`;
                  return (
                    <WeekCell
                      key={ws.toISOString()}
                      cellId={key}
                      projectId={p.id}
                      weekStart={ws}
                      visits={visitsByKey[key] ?? []}
                      onVisitClick={onVisitClick}
                      onCellClick={onCellClick}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
