import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { format, parseISO } from 'date-fns';
import type { ProjectWithPriority } from '../../services/safetyVisits';

interface Props {
  project: ProjectWithPriority;
  visitCount: number;
}

function getPriorityStyle(p: ProjectWithPriority): { label: string; color: string; bg: string } {
  if (p.needs_kickoff) return { label: 'KICKOFF', color: '#dc2626', bg: '#fee2e2' };
  if (p.remaining_hours > 2000) return { label: 'HIGH', color: '#d97706', bg: '#fef3c7' };
  if (p.remaining_hours > 500) return { label: 'MED', color: '#2563eb', bg: '#dbeafe' };
  return { label: 'LOW', color: '#6b7280', bg: '#f3f4f6' };
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return format(parseISO(d), 'M/d/yy'); } catch { return '—'; }
}

function formatDaysAgo(days: number | null): string {
  if (days === null || days === undefined) return 'Never visited';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export const ProjectSidebarItem: React.FC<Props> = React.memo(({ project, visitCount }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `project-${project.id}`,
    data: { project },
  });

  const badge = getPriorityStyle(project);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        margin: '6px 8px',
        padding: '10px 12px',
        borderRadius: '8px',
        border: `1px solid ${badge.color}30`,
        borderLeft: `3px solid ${badge.color}`,
        background: isDragging ? '#f3f4f6' : '#fff',
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        userSelect: 'none',
        transition: 'opacity 0.15s, box-shadow 0.15s',
        boxShadow: isDragging ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
      }}
      title={`Drag to calendar to schedule a visit`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
        <span style={{
          display: 'inline-block',
          padding: '1px 6px',
          borderRadius: '8px',
          fontSize: '9px',
          fontWeight: 800,
          letterSpacing: '0.03em',
          background: badge.bg,
          color: badge.color,
          flexShrink: 0,
        }}>
          {badge.label}
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {project.name}
        </span>
      </div>
      <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '3px' }}>
        #{project.number}
        {project.department_name && <span style={{ marginLeft: '6px', color: '#9ca3af' }}>{project.department_name}</span>}
        {(project.ship_city || project.ship_state) && (
          <span style={{ marginLeft: '6px', color: '#9ca3af' }}>
            · {[project.ship_city, project.ship_state?.split(/\s+/)[0]].filter(Boolean).join(', ')}
          </span>
        )}
      </div>
      {project.manager_name && (
        <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>
          <span style={{ color: '#9ca3af' }}>PM:</span> {project.manager_name}
        </div>
      )}
      {/* Percent complete bar */}
      <div style={{ marginTop: '6px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', marginBottom: '2px' }}>
          <span>{fmtDate(project.start_date)} – {fmtDate(project.end_date)}</span>
          <span style={{ fontWeight: 700, color: '#374151' }}>{project.percent_complete ?? 0}%</span>
        </div>
        <div style={{ height: '4px', borderRadius: '2px', background: '#e5e7eb', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${project.percent_complete ?? 0}%`,
            borderRadius: '2px',
            background: (project.percent_complete ?? 0) >= 90 ? '#10b981' : (project.percent_complete ?? 0) >= 50 ? '#3b82f6' : '#f97316',
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
        <span title="Remaining labor hours">
          ⏱ {project.remaining_hours > 0 ? `${Math.round(project.remaining_hours).toLocaleString()} hrs` : '—'}
        </span>
        <span title={project.last_visit_date ? `Last visit: ${project.last_visit_date}` : 'No prior visits'}>
          👁 {formatDaysAgo(project.days_since_last_visit)}
        </span>
        {visitCount > 0 && (
          <span style={{ marginLeft: 'auto', background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>
            {visitCount} scheduled
          </span>
        )}
      </div>
    </div>
  );
});
