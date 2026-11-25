import React, { useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { format, addDays, parseISO, differenceInDays, isSameDay } from 'date-fns';
import { VisitBar, LANE_H } from './VisitBar';
import type { SafetyVisit } from '../../services/safetyVisits';

interface Props {
  weekStarts: Date[];
  visits: SafetyVisit[];
  onVisitClick: (visit: SafetyVisit) => void;
  onResizeVisit: (visitId: number, newEndDate: string) => void;
  onDeleteVisit: (visitId: number) => void;
  memberColorMap: Record<number, string>;
}

const LABEL_W = 68;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MIN_ROW_H = 36;

// Alternating month shading — even/odd calendar month index
const MONTH_SHADES = [
  { cell: '#ffffff', weekend: '#f5f5f6', label: '#f9fafb' },
  { cell: '#f0f4fb', weekend: '#e8ecf5', label: '#eaeff8' },
] as const;

function getMonthShade(date: Date): 0 | 1 {
  return ((date.getFullYear() * 12 + date.getMonth()) % 2) as 0 | 1;
}

interface VisitSegment {
  visit: SafetyVisit;
  lane: number;
  startDay: number;
  spanDays: number;
  isLastSegment: boolean;
  weekStart: Date;
}

function computeWeekSegments(visits: SafetyVisit[], weekStart: Date): VisitSegment[] {
  const weekEnd = addDays(weekStart, 6);

  const inThisWeek = visits.filter(v => {
    if (!v.scheduled_date) return false;
    const vStart = parseISO(v.scheduled_date);
    const vEnd = v.end_date ? parseISO(v.end_date) : vStart;
    return vStart <= weekEnd && vEnd >= weekStart;
  });

  const raw = inThisWeek.map(v => {
    const vStart = parseISO(v.scheduled_date!);
    const vEnd = v.end_date ? parseISO(v.end_date) : vStart;
    const effectiveStart = vStart < weekStart ? weekStart : vStart;
    const effectiveEnd = vEnd > weekEnd ? weekEnd : vEnd;
    const startDay = differenceInDays(effectiveStart, weekStart);
    const spanDays = Math.max(1, differenceInDays(effectiveEnd, effectiveStart) + 1);
    const isLastSegment = vEnd <= weekEnd;
    return { visit: v, lane: 0, startDay, spanDays, isLastSegment, weekStart };
  });

  raw.sort((a, b) => a.startDay - b.startDay || b.spanDays - a.spanDays);
  const laneEnds: number[] = [];
  for (const seg of raw) {
    let lane = laneEnds.findIndex(e => e < seg.startDay);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = seg.startDay + seg.spanDays - 1;
    seg.lane = lane;
  }

  return raw;
}

// Day drop target
const DayCell = React.memo<{
  date: Date;
  isToday: boolean;
  isWeekend: boolean;
  monthShade: 0 | 1;
}>(({ date, isToday, isWeekend, monthShade }) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  const { isOver, setNodeRef } = useDroppable({ id: `day-${dateStr}`, data: { date } });
  const shade = MONTH_SHADES[monthShade];

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1,
        borderRight: '1px solid #e5e7eb',
        background: isOver ? '#bfdbfe'
          : isToday ? '#fefce8'
          : isWeekend ? shade.weekend
          : shade.cell,
        boxShadow: isOver ? 'inset 0 0 0 2px #2563eb' : 'none',
        transition: 'background 0.1s, box-shadow 0.1s',
        minHeight: `${MIN_ROW_H}px`,
        position: 'relative',
      }}
    >
      <span style={{
        position: 'absolute',
        top: '3px',
        right: '4px',
        fontSize: '9px',
        fontWeight: isToday ? 700 : 400,
        color: isToday ? '#2563eb' : isWeekend ? '#9ca3af' : '#d1d5db',
        userSelect: 'none',
        pointerEvents: 'none',
      }}>
        {format(date, 'M/d')}
      </span>
    </div>
  );
});

const WeekRow = React.memo<{
  weekStart: Date;
  segments: VisitSegment[];
  today: Date;
  isCurrentWeek: boolean;
  monthShade: 0 | 1;
  onVisitClick: (visit: SafetyVisit) => void;
  onResizeVisit: (visitId: number, newEndDate: string) => void;
  onDeleteVisit: (visitId: number) => void;
  memberColorMap: Record<number, string>;
}>(({ weekStart, segments, today, isCurrentWeek, monthShade, onVisitClick, onResizeVisit, onDeleteVisit, memberColorMap }) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const numLanes = segments.length > 0 ? Math.max(...segments.map(s => s.lane)) + 1 : 0;
  const rowH = Math.max(MIN_ROW_H, numLanes * LANE_H + 8);
  const shade = MONTH_SHADES[monthShade];

  // Scroll this week into view on first mount
  useEffect(() => {
    if (isCurrentWeek) {
      rowRef.current?.scrollIntoView({ block: 'start' });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={rowRef} style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', minHeight: `${rowH}px` }}>
      {/* Week label */}
      <div style={{
        width: `${LABEL_W}px`,
        flexShrink: 0,
        padding: '8px 6px',
        fontSize: '11px',
        fontWeight: isCurrentWeek ? 700 : 500,
        color: isCurrentWeek ? '#002356' : '#6b7280',
        background: isCurrentWeek ? '#eff6ff' : shade.label,
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}>
        <span>{format(weekStart, 'MMM d')}</span>
        {isCurrentWeek && <span style={{ fontSize: '9px', color: '#2563eb', fontWeight: 400, marginTop: '1px' }}>THIS WK</span>}
      </div>

      {/* Day cells + bars overlay */}
      <div ref={gridRef} style={{ flex: 1, position: 'relative', display: 'flex' }}>
        {Array.from({ length: 7 }, (_, i) => {
          const day = addDays(weekStart, i);
          return (
            <DayCell
              key={i}
              date={day}
              isToday={isSameDay(day, today)}
              isWeekend={i >= 5}
              monthShade={monthShade}
            />
          );
        })}

        {/* Visit bars overlay */}
        {segments.length > 0 && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {segments.map(seg => (
              <div key={`${seg.visit.id}-${seg.startDay}`} style={{ pointerEvents: 'auto' }}>
                <VisitBar
                  visit={seg.visit}
                  startDay={seg.startDay}
                  spanDays={seg.spanDays}
                  lane={seg.lane}
                  weekStart={weekStart}
                  isLastSegment={seg.isLastSegment}
                  gridRef={gridRef}
                  onClick={onVisitClick}
                  onResize={onResizeVisit}
                  onDelete={onDeleteVisit}
                  memberColor={memberColorMap[seg.visit.assigned_to ?? -1]}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export const SafetyCalendarGrid: React.FC<Props> = ({
  weekStarts,
  visits,
  onVisitClick,
  onResizeVisit,
  onDeleteVisit,
  memberColorMap,
}) => {
  const today = new Date();

  const segmentsByWeek = React.useMemo(
    () => weekStarts.map(ws => computeWeekSegments(visits, ws)),
    [visits, weekStarts]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Sticky day-of-week header */}
      <div style={{
        display: 'flex',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: '#f9fafb',
        borderBottom: '2px solid #e5e7eb',
        flexShrink: 0,
      }}>
        <div style={{ width: `${LABEL_W}px`, flexShrink: 0, borderRight: '1px solid #e5e7eb', padding: '6px 6px', fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Week
        </div>
        {DAY_NAMES.map((name, i) => {
          const isWeekend = i >= 5;
          return (
            <div key={name} style={{
              flex: 1,
              padding: '6px 0',
              textAlign: 'center',
              fontSize: '11px',
              fontWeight: 700,
              color: isWeekend ? '#9ca3af' : '#374151',
              borderRight: '1px solid #e5e7eb',
              background: isWeekend ? '#fafafa' : '#f9fafb',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {name}
            </div>
          );
        })}
      </div>

      {/* All week rows */}
      {weekStarts.map((ws, i) => {
        const isCurrentWeek = isSameDay(ws, startOfCurrentWeek(today));
        return (
          <WeekRow
            key={ws.toISOString()}
            weekStart={ws}
            segments={segmentsByWeek[i]}
            today={today}
            isCurrentWeek={isCurrentWeek}
            monthShade={getMonthShade(ws)}
            onVisitClick={onVisitClick}
            onResizeVisit={onResizeVisit}
            onDeleteVisit={onDeleteVisit}
            memberColorMap={memberColorMap}
          />
        );
      })}
    </div>
  );
};

function startOfCurrentWeek(today: Date): Date {
  const d = new Date(today);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
