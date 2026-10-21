import React, { useState } from 'react';
import {
  format, startOfWeek, addDays, addWeeks, subWeeks, isToday, parseISO,
} from 'date-fns';
import { Meeting } from '../../services/meetings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';

interface Props {
  meetings: Meeting[];
  projectId: string;
  onNavigate: (path: string) => void;
}

const START_HOUR = 7;
const END_HOUR = 20;
const HOUR_PX = 64;
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const minutesToPx = (minutes: number) => {
  const fromStart = minutes - START_HOUR * 60;
  return (fromStart / 60) * HOUR_PX;
};

const formatTimeLabel = (hour: number) => {
  if (hour === 12) return '12 PM';
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
};

const formatTimeShort = (t: string) => {
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m}${hour >= 12 ? 'p' : 'a'}`;
};

const STATUS_COLOR: Record<string, { bg: string; border: string; color: string }> = {
  draft:     { bg: '#fef9c3', border: '#fbbf24', color: '#78350f' },
  published: { bg: '#dbeafe', border: '#3b82f6', color: '#1e3a8a' },
  closed:    { bg: '#f3f4f6', border: '#d1d5db', color: '#4b5563' },
};

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const MeetingCalendarWeek: React.FC<Props> = ({ meetings, projectId, onNavigate }) => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const byDay = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    return meetings.filter(m => m.scheduled_date === key);
  };

  const handleSlotClick = (date: Date, hour: number) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const timeStr = `${String(hour).padStart(2, '0')}:00`;
    onNavigate(`/projects/${projectId}/meetings/new?date=${dateStr}&time=${timeStr}`);
  };

  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`;

  return (
    <div>
      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="btn-icon" title="Previous week" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
          <ChevronLeftIcon />
        </button>
        <button className="btn-icon" title="Next week" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
          <ChevronRightIcon />
        </button>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#1e3a5f', minWidth: 240 }}>
          {weekLabel}
        </span>
        <button className="sales-btn sales-btn-secondary" style={{ marginLeft: 8, padding: '4px 10px', fontSize: 12 }}
          onClick={() => setWeekStart(startOfWeek(new Date()))}>
          <TodayIcon style={{ fontSize: 15 }} /> Today
        </button>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        {/* Day header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '2px solid #e5e7eb', background: '#f8fafc' }}>
          <div /> {/* time gutter */}
          {days.map((date, i) => {
            const today = isToday(date);
            return (
              <div key={i} style={{ padding: '10px 0', textAlign: 'center', borderLeft: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {format(date, 'EEE')}
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: '50%', marginTop: 2,
                  background: today ? '#1d4ed8' : 'transparent',
                  fontSize: 16, fontWeight: today ? 700 : 500,
                  color: today ? '#fff' : '#374151',
                }}>
                  {format(date, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day meetings (no time set) */}
        {days.some(d => byDay(d).some(m => !m.start_time)) && (
          <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb', background: '#fafafa', minHeight: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
              ALL DAY
            </div>
            {days.map((date, i) => {
              const allDay = byDay(date).filter(m => !m.start_time);
              return (
                <div key={i} style={{ borderLeft: '1px solid #e5e7eb', padding: '3px 4px' }}>
                  {allDay.map(m => {
                    const s = STATUS_COLOR[m.status] || STATUS_COLOR.draft;
                    return (
                      <div
                        key={m.id}
                        onClick={() => onNavigate(`/projects/${projectId}/meetings/${m.id}`)}
                        style={{
                          background: s.bg, borderLeft: `3px solid ${s.border}`, color: s.color,
                          fontSize: 11, fontWeight: 500, padding: '1px 5px', borderRadius: '0 3px 3px 0',
                          cursor: 'pointer', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {m.title}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Scrollable time grid */}
        <div style={{ overflowY: 'auto', maxHeight: 600 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', position: 'relative' }}>
            {/* Time labels */}
            <div style={{ position: 'relative', height: TOTAL_HEIGHT }}>
              {HOURS.map(h => (
                <div key={h} style={{
                  position: 'absolute', top: (h - START_HOUR) * HOUR_PX - 9,
                  right: 6, fontSize: 10, color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  {formatTimeLabel(h)}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((date, di) => {
              const today = isToday(date);
              const dayMeetings = byDay(date).filter(m => m.start_time);
              const dateStr = format(date, 'yyyy-MM-dd');

              return (
                <div
                  key={di}
                  style={{
                    position: 'relative', height: TOTAL_HEIGHT,
                    borderLeft: '1px solid #e5e7eb',
                    background: today ? '#fafcff' : '#fff',
                  }}
                >
                  {/* Hour grid lines + click targets */}
                  {HOURS.map(h => (
                    <div
                      key={h}
                      onClick={() => handleSlotClick(date, h)}
                      style={{
                        position: 'absolute', top: (h - START_HOUR) * HOUR_PX,
                        left: 0, right: 0, height: HOUR_PX,
                        borderTop: '1px solid #f0f0f0',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(59,130,246,0.04)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {today && (() => {
                    const now = new Date();
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    const top = minutesToPx(nowMin);
                    if (top < 0 || top > TOTAL_HEIGHT) return null;
                    return (
                      <div style={{ position: 'absolute', top, left: 0, right: 0, zIndex: 5, pointerEvents: 'none' }}>
                        <div style={{ height: 2, background: '#ef4444' }} />
                        <div style={{ position: 'absolute', top: -4, left: -1, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                      </div>
                    );
                  })()}

                  {/* Meeting chips */}
                  {dayMeetings.map(m => {
                    const startMin = timeToMinutes(m.start_time!);
                    const endMin = m.end_time ? timeToMinutes(m.end_time) : startMin + 60;
                    const top = minutesToPx(startMin);
                    const height = Math.max((endMin - startMin) / 60 * HOUR_PX, 24);
                    const s = STATUS_COLOR[m.status] || STATUS_COLOR.draft;
                    if (top < 0 || top > TOTAL_HEIGHT) return null;

                    return (
                      <div
                        key={m.id}
                        onClick={e => { e.stopPropagation(); onNavigate(`/projects/${projectId}/meetings/${m.id}`); }}
                        title={m.title}
                        style={{
                          position: 'absolute', top, left: 2, right: 2, height,
                          background: s.bg, borderLeft: `3px solid ${s.border}`, color: s.color,
                          borderRadius: '0 4px 4px 0', padding: '2px 5px',
                          fontSize: 11, fontWeight: 500, overflow: 'hidden', cursor: 'pointer',
                          zIndex: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.85'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                      >
                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.title}
                        </div>
                        {height > 30 && (
                          <div style={{ fontSize: 10, opacity: 0.8 }}>
                            {formatTimeShort(m.start_time!)}{m.end_time ? ` – ${formatTimeShort(m.end_time)}` : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingCalendarWeek;
