import React, { useState } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isToday, parseISO,
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

const STATUS_CHIP: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#fef3c7', color: '#92400e' },
  published: { bg: '#dbeafe', color: '#1d4ed8' },
  closed:    { bg: '#f3f4f6', color: '#6b7280' },
};

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MeetingCalendarMonth: React.FC<Props> = ({ meetings, projectId, onNavigate }) => {
  const [current, setCurrent] = useState(() => new Date());

  const monthStart = startOfMonth(current);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(endOfMonth(current));

  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(day)); day = addDays(day, 1); }
    weeks.push(week);
  }

  const byDate = (date: Date) => {
    const key = format(date, 'yyyy-MM-dd');
    return meetings.filter(m => m.scheduled_date?.substring(0, 10) === key)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  };

  return (
    <div>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button className="btn-icon" title="Previous month" onClick={() => setCurrent(subMonths(current, 1))}>
          <ChevronLeftIcon />
        </button>
        <button className="btn-icon" title="Next month" onClick={() => setCurrent(addMonths(current, 1))}>
          <ChevronRightIcon />
        </button>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#1e3a5f', minWidth: 180 }}>
          {format(current, 'MMMM yyyy')}
        </span>
        <button className="sales-btn sales-btn-secondary" style={{ marginLeft: 8, padding: '4px 10px', fontSize: 12 }}
          onClick={() => setCurrent(new Date())}>
          <TodayIcon style={{ fontSize: 15 }} /> Today
        </button>
      </div>

      {/* Calendar grid */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
          {DAY_HEADERS.map(d => (
            <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {week.map((date, di) => {
              const dayMeetings = byDate(date);
              const inMonth = isSameMonth(date, current);
              const today = isToday(date);
              const dateStr = format(date, 'yyyy-MM-dd');
              const isLast = wi === weeks.length - 1;

              return (
                <div
                  key={di}
                  onClick={() => onNavigate(`/projects/${projectId}/meetings/new?date=${dateStr}`)}
                  style={{
                    minHeight: 110,
                    padding: '6px 8px 8px',
                    borderRight: di < 6 ? '1px solid #e5e7eb' : 'none',
                    borderBottom: isLast ? 'none' : '1px solid #e5e7eb',
                    background: today ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!today) (e.currentTarget as HTMLDivElement).style.background = '#f9fafb'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = today ? '#eff6ff' : '#fff'; }}
                >
                  {/* Day number */}
                  <div style={{ marginBottom: 4 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 26, height: 26, borderRadius: '50%', fontSize: 13, fontWeight: today ? 700 : 500,
                      background: today ? '#1d4ed8' : 'transparent',
                      color: today ? '#fff' : inMonth ? '#374151' : '#c9d0da',
                    }}>
                      {format(date, 'd')}
                    </span>
                  </div>

                  {/* Meeting chips */}
                  {dayMeetings.slice(0, 3).map(m => {
                    const chip = STATUS_CHIP[m.status] || STATUS_CHIP.draft;
                    return (
                      <div
                        key={m.id}
                        onClick={e => { e.stopPropagation(); onNavigate(`/projects/${projectId}/meetings/${m.id}`); }}
                        title={m.title}
                        style={{
                          background: chip.bg, color: chip.color,
                          fontSize: 11, fontWeight: 500,
                          padding: '2px 6px', borderRadius: 4, marginBottom: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.8'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                      >
                        {m.start_time ? `${formatTime(m.start_time)} ` : ''}{m.title}
                      </div>
                    );
                  })}
                  {dayMeetings.length > 3 && (
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                      +{dayMeetings.length - 3} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const formatTime = (t: string) => {
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m}${hour >= 12 ? 'p' : 'a'}`;
};

export default MeetingCalendarMonth;
