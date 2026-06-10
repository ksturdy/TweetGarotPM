import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TuneIcon from '@mui/icons-material/Tune';
import { laborApi, AssignmentRecord, ASSIGNMENT_TRADES } from '../../services/labor';
import PillFilter from '../../components/labor/PillFilter';
import '../../styles/SalesPipeline.css';
import '../Dashboard.css';

// ── View definitions ───────────────────────────────────────────────────
type ViewKey = '1w' | '2w' | '4w' | '1mo' | '3mo' | '6mo' | '1y' | '18mo' | '2y';

interface ViewDef {
  label: string;
  days: number;          // total span shown
  unit: 'day' | 'week' | 'month';
  cellWidth: number;     // px per unit
}

const VIEWS: Record<ViewKey, ViewDef> = {
  '1w':   { label: '1 week',    days: 7,   unit: 'day',   cellWidth: 92 },
  '2w':   { label: '2 weeks',   days: 14,  unit: 'day',   cellWidth: 68 },
  '4w':   { label: '4 weeks',   days: 28,  unit: 'day',   cellWidth: 42 },
  '1mo':  { label: '1 month',   days: 30,  unit: 'week',  cellWidth: 100 },
  '3mo':  { label: '3 months',  days: 90,  unit: 'week',  cellWidth: 60 },
  '6mo':  { label: '6 months',  days: 180, unit: 'week',  cellWidth: 42 },
  '1y':   { label: '1 year',    days: 365, unit: 'month', cellWidth: 80 },
  '18mo': { label: '18 months', days: 547, unit: 'month', cellWidth: 64 },
  '2y':   { label: '2 years',   days: 730, unit: 'month', cellWidth: 50 },
};

const PREFS_KEY = 'labor_calendar_prefs';

interface CalendarPrefs {
  defaultView: ViewKey;
}

const loadPrefs = (): CalendarPrefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { defaultView: '6mo', ...JSON.parse(raw) };
  } catch {}
  return { defaultView: '6mo' };
};

const EMPLOYEE_COL_WIDTH = 200;
const ROW_HEIGHT = 38;
const HEADER_TOP = 22;
const HEADER_BOTTOM = 30;
const HEADER_HEIGHT = HEADER_TOP + HEADER_BOTTOM;
const DAY_MS = 86400000;

// ── Date helpers ───────────────────────────────────────────────────────
const isoDate = (d: Date) => {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const startOfWeek = (d: Date) => addDays(startOfDay(d), -d.getDay());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);

const STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  planned:   { bg: '#ffedd5', border: '#ea580c', color: '#7c2d12' },
  active:    { bg: '#dbeafe', border: '#1d4ed8', color: '#1e3a8a' },
  completed: { bg: '#e2e8f0', border: '#475569', color: '#1e293b' },
};
const STATUS_DEFAULT = STATUS_COLORS.planned;

const LaborCalendar: React.FC = () => {
  const [view, setView] = useState<ViewKey>(() => loadPrefs().defaultView);
  const viewDef = VIEWS[view];

  // Anchor is the START of the visible window. Default: start of current month for longer views.
  const [anchor, setAnchor] = useState<Date>(() => {
    const v = loadPrefs().defaultView;
    return VIEWS[v].unit === 'day' ? startOfWeek(new Date()) : startOfMonth(new Date());
  });

  const [trade, setTrade] = useState<string | undefined>();
  const [group, setGroup] = useState<string | undefined>();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [draftView, setDraftView] = useState<ViewKey>('6mo');

  const viewStart = startOfDay(anchor);
  const viewEnd = addDays(viewStart, viewDef.days - 1);

  const from = isoDate(viewStart);
  const to = isoDate(viewEnd);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['labor-calendar', from, to, trade, group],
    queryFn: () => laborApi.getCalendar(from, to, { trade, group }),
  });

  const { data: allRows } = useQuery({
    queryKey: ['labor-board', {}, ''],
    queryFn: () => laborApi.getBoard(),
    staleTime: 5 * 60_000,
  });

  const { trades, groups } = useMemo(() => {
    const tr = new Set<string>(ASSIGNMENT_TRADES); const g = new Set<string>();
    (allRows || []).forEach((r) => {
      if (r.trade) tr.add(r.trade);
      if (r.employee_group) g.add(r.employee_group);
    });
    return { trades: [...tr].sort(), groups: [...g].sort() };
  }, [allRows]);

  // ── Compute pixel scale ─────────────────────────────────────────────
  // Header is two tiers:
  //   superMarkers (top band) — e.g. "June 2026" spanning weeks in that month
  //   subMarkers   (bottom band) — short labels: day/date for day-view,
  //                               "6/14" for week-view, "Jun" for month-view
  const { pxPerDay, timelineWidth, superMarkers, subMarkers, gridLines } = useMemo(() => {
    let _pxPerDay = 0;
    const supers: { label: string; left: number; width: number }[] = [];
    const subs: { label: string; left: number; width: number; isWeekend?: boolean }[] = [];
    const lines: number[] = [];

    const pushSuperMonth = (cursorDate: Date, leftPx: number, widthPx: number) => {
      const label = cursorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const last = supers[supers.length - 1];
      if (last && last.label === label) {
        last.width = leftPx + widthPx - last.left;
      } else {
        supers.push({ label, left: leftPx, width: widthPx });
      }
    };

    if (viewDef.unit === 'day') {
      _pxPerDay = viewDef.cellWidth;
      for (let i = 0; i < viewDef.days; i++) {
        const d = addDays(viewStart, i);
        const dow = d.getDay();
        const left = i * _pxPerDay;
        subs.push({
          label: `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getMonth() + 1}/${d.getDate()}`,
          left,
          width: _pxPerDay,
          isWeekend: dow === 0 || dow === 6,
        });
        pushSuperMonth(d, left, _pxPerDay);
        if (i > 0) lines.push(left);
      }
    } else if (viewDef.unit === 'week') {
      _pxPerDay = viewDef.cellWidth / 7;
      let cursor = startOfWeek(viewStart);
      while (cursor <= viewEnd) {
        const next = addDays(cursor, 7);
        const startOffsetDays = daysBetween(viewStart, cursor);
        const left = startOffsetDays * _pxPerDay;
        const width = 7 * _pxPerDay;
        subs.push({
          label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
          left, width,
        });
        // Walk this week day-by-day to attribute each chunk to its calendar
        // month (a week can straddle two months).
        for (let i = 0; i < 7; i++) {
          const day = addDays(cursor, i);
          if (day > viewEnd) break;
          pushSuperMonth(day, left + i * _pxPerDay, _pxPerDay);
        }
        if (startOffsetDays > 0) lines.push(left);
        cursor = next;
      }
    } else {
      // month
      _pxPerDay = viewDef.cellWidth / 30;
      let cursor = startOfMonth(viewStart);
      while (cursor <= viewEnd) {
        const next = addMonths(cursor, 1);
        const monthDays = daysBetween(cursor, next);
        const startOffsetDays = daysBetween(viewStart, cursor);
        const left = startOffsetDays * _pxPerDay;
        const width = monthDays * _pxPerDay;
        subs.push({
          label: cursor.toLocaleDateString('en-US', { month: 'short' }),
          left, width,
        });
        // Super = year for month-view, so 1/2/3yr spans group by year.
        const yearLabel = cursor.toLocaleDateString('en-US', { year: 'numeric' });
        const lastSuper = supers[supers.length - 1];
        if (lastSuper && lastSuper.label === yearLabel) {
          lastSuper.width = left + width - lastSuper.left;
        } else {
          supers.push({ label: yearLabel, left, width });
        }
        if (startOffsetDays > 0) lines.push(left);
        cursor = next;
      }
    }

    return {
      pxPerDay: _pxPerDay,
      timelineWidth: viewDef.days * _pxPerDay,
      superMarkers: supers,
      subMarkers: subs,
      gridLines: lines,
    };
  }, [viewDef, viewStart, viewEnd]);

  // ── Group assignments by employee ─────────────────────────────────────
  const byEmployee = useMemo(() => {
    const map = new Map<number, { name: string; bars: AssignmentRecord[] }>();
    for (const a of rows) {
      const key = a.employee_id;
      if (!map.has(key)) {
        map.set(key, {
          name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || `#${key}`,
          bars: [],
        });
      }
      map.get(key)!.bars.push(a);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [rows]);

  // ── Bar position calculator ─────────────────────────────────────────
  const barPos = (a: AssignmentRecord) => {
    if (!a.start_date) return null;
    const start = startOfDay(new Date(a.start_date));
    const end = a.end_date ? startOfDay(new Date(a.end_date)) : viewEnd;

    // Clamp to visible window
    const clampedStart = start < viewStart ? viewStart : start;
    const clampedEnd = end > viewEnd ? viewEnd : end;
    if (clampedEnd < viewStart || clampedStart > viewEnd) return null;

    const offsetDays = daysBetween(viewStart, clampedStart);
    const durDays = daysBetween(clampedStart, clampedEnd) + 1;
    return {
      left: offsetDays * pxPerDay,
      width: Math.max(4, durDays * pxPerDay),
      extendsLeft: start < viewStart,
      extendsRight: end > viewEnd,
    };
  };

  // ── Today line position ─────────────────────────────────────────────
  const todayLineLeft = (() => {
    const today = startOfDay(new Date());
    if (today < viewStart || today > viewEnd) return null;
    return daysBetween(viewStart, today) * pxPerDay;
  })();

  // ── Navigation ──────────────────────────────────────────────────────
  const navigate = (direction: -1 | 0 | 1) => {
    if (direction === 0) {
      setAnchor(viewDef.unit === 'day' ? startOfWeek(new Date()) : startOfMonth(new Date()));
      return;
    }
    if (viewDef.unit === 'day') {
      setAnchor(addDays(anchor, direction * viewDef.days));
    } else if (viewDef.unit === 'week') {
      setAnchor(addDays(anchor, direction * Math.max(7, Math.floor(viewDef.days / 4))));
    } else {
      const monthsJump = Math.max(1, Math.floor(viewDef.days / 60));
      setAnchor(addMonths(anchor, direction * monthsJump));
    }
  };

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/labor" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>← Back to Labor Board</Link>
            <h1>📅 Labor Calendar</h1>
            <div className="sales-subtitle">Multi-period crew coverage at a glance.</div>
          </div>
        </div>
        <div className="sales-header-actions" style={{ gap: '0.5rem', display: 'flex', alignItems: 'center' }}>
          <button className="sales-filter-btn" onClick={() => navigate(-1)}>← Prev</button>
          <button className="sales-filter-btn" onClick={() => navigate(0)}>Today</button>
          <button className="sales-filter-btn" onClick={() => navigate(1)}>Next →</button>
          <select className="sales-filter-btn" value={view} onChange={(e) => setView(e.target.value as ViewKey)}>
            {(Object.keys(VIEWS) as ViewKey[]).map((k) => (
              <option key={k} value={k}>{VIEWS[k].label}</option>
            ))}
          </select>
          <button
            className="customize-button"
            onClick={() => { setDraftView(loadPrefs().defaultView); setCustomizeOpen(true); }}
            title="Customize calendar defaults"
          >
            <TuneIcon fontSize="small" />
            <span>Customize</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <PillFilter label="Group" value={group} options={groups} onChange={setGroup} />
        <PillFilter label="Trade" value={trade} options={trades} onChange={setTrade} />
      </div>

      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 8 }}>
        Showing {viewStart.toLocaleDateString()} → {viewEnd.toLocaleDateString()}
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : byEmployee.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No assignments in this range.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: EMPLOYEE_COL_WIDTH + timelineWidth, position: 'relative' }}>
              {/* Header — two tier: month/year band on top, short labels below */}
              <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{
                  width: EMPLOYEE_COL_WIDTH, padding: '0 0.75rem',
                  fontSize: '0.7rem', textTransform: 'uppercase', color: '#475569',
                  fontWeight: 700, letterSpacing: 0.5,
                  borderRight: '1px solid #e2e8f0', boxSizing: 'border-box',
                  display: 'flex', alignItems: 'flex-end', paddingBottom: 8,
                  height: HEADER_HEIGHT,
                }}>
                  Employee
                </div>
                <div style={{ width: timelineWidth, height: HEADER_HEIGHT, position: 'relative' }}>
                  {/* Super band */}
                  {superMarkers.map((m, i) => (
                    <div
                      key={`super-${i}`}
                      style={{
                        position: 'absolute',
                        left: m.left, width: m.width,
                        top: 0, height: HEADER_TOP,
                        borderRight: '1px solid #e2e8f0',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', fontWeight: 700, color: '#1e293b',
                        background: i % 2 === 0 ? '#f8fafc' : '#eef2f7',
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        padding: '0 4px',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</span>
                    </div>
                  ))}
                  {/* Sub band */}
                  {subMarkers.map((m, i) => (
                    <div
                      key={`sub-${i}`}
                      style={{
                        position: 'absolute',
                        left: m.left, width: m.width,
                        top: HEADER_TOP, height: HEADER_BOTTOM,
                        borderRight: '1px solid #e2e8f0',
                        background: m.isWeekend ? '#f1f5f9' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.68rem', color: '#475569', fontWeight: 600,
                        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Today line — overlay across all rows */}
              {todayLineLeft != null && (
                <div
                  style={{
                    position: 'absolute',
                    top: HEADER_HEIGHT + 2,
                    bottom: 0,
                    left: EMPLOYEE_COL_WIDTH + todayLineLeft,
                    width: 2,
                    background: '#ef4444',
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                />
              )}

              {/* Employee rows */}
              {byEmployee.map(([empId, { name, bars }]) => (
                <div
                  key={empId}
                  style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', height: ROW_HEIGHT }}
                >
                  <div
                    style={{
                      width: EMPLOYEE_COL_WIDTH,
                      padding: '0 0.75rem',
                      display: 'flex', alignItems: 'center',
                      fontSize: '0.85rem', fontWeight: 500,
                      borderRight: '1px solid #e2e8f0',
                      boxSizing: 'border-box',
                      background: 'white',
                    }}
                  >
                    <Link to={`/labor/employee/${empId}`} style={{ color: '#002356', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </Link>
                  </div>
                  <div style={{ width: timelineWidth, height: ROW_HEIGHT, position: 'relative' }}>
                    {/* Vertical grid lines */}
                    {gridLines.map((x, i) => (
                      <div key={i} style={{ position: 'absolute', left: x, top: 0, bottom: 0, width: 1, background: '#f1f5f9' }} />
                    ))}
                    {/* Bars */}
                    {bars.map((a) => {
                      const pos = barPos(a);
                      if (!pos) return null;
                      const today = new Date(); today.setHours(0,0,0,0);
                      const s = a.start_date ? new Date(a.start_date) : null;
                      const e = a.end_date ? new Date(a.end_date) : null;
                      const autoStatus = (s && e && s <= today && e >= today) ? 'active' : (a.status || 'planned');
                      const colors = STATUS_COLORS[autoStatus] || STATUS_DEFAULT;
                      return (
                        <Link
                          key={a.id}
                          to={`/projects/${a.project_id}`}
                          title={`${a.project_name}${a.project_number ? ` (#${a.project_number})` : ''}\n${a.role || ''}${a.trade ? ' · ' + a.trade : ''}\n${a.start_date ? new Date(a.start_date).toLocaleDateString() : '?'} → ${a.end_date ? new Date(a.end_date).toLocaleDateString() : 'open'}`}
                          style={{
                            position: 'absolute',
                            left: pos.left + 1,
                            width: Math.max(2, pos.width - 2),
                            top: 5,
                            bottom: 5,
                            background: colors.bg,
                            border: `1px solid ${colors.border}`,
                            borderLeftWidth: pos.extendsLeft ? 0 : 1,
                            borderRightWidth: pos.extendsRight ? 0 : 1,
                            borderRadius: 4,
                            color: colors.color,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0 6px',
                            display: 'flex', alignItems: 'center',
                            overflow: 'hidden',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {a.project_name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: 8, fontSize: '0.75rem', color: '#64748b', alignItems: 'center', flexWrap: 'wrap' }}>
        <LegendChip color={STATUS_COLORS.planned}>Planned</LegendChip>
        <LegendChip color={STATUS_COLORS.active}>Active</LegendChip>
        <LegendChip color={STATUS_COLORS.completed}>Completed</LegendChip>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 2, height: 14, background: '#ef4444' }} /> Today
        </span>
      </div>

      {/* Customize drawer */}
      {customizeOpen && (
        <>
          <div
            onClick={() => setCustomizeOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 1000 }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 360,
            background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            zIndex: 1001, display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TuneIcon style={{ color: '#6b7280', fontSize: '1.25rem' }} />
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>Calendar Preferences</span>
              </div>
              <button
                onClick={() => setCustomizeOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.25rem', lineHeight: 1 }}
              >×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  Default View
                </div>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem', marginTop: 0 }}>
                  Choose which time span loads when you open the calendar.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {(Object.keys(VIEWS) as ViewKey[]).map((k) => (
                    <label
                      key={k}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.5rem 0.75rem', borderRadius: 8, cursor: 'pointer',
                        background: draftView === k ? '#eff6ff' : 'transparent',
                        border: `1px solid ${draftView === k ? '#bfdbfe' : 'transparent'}`,
                        fontSize: '0.875rem', color: draftView === k ? '#1d4ed8' : '#374151',
                        fontWeight: draftView === k ? 600 : 400,
                      }}
                    >
                      <input
                        type="radio"
                        name="defaultView"
                        value={k}
                        checked={draftView === k}
                        onChange={() => setDraftView(k)}
                        style={{ accentColor: '#1d4ed8' }}
                      />
                      {VIEWS[k].label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => setCustomizeOpen(false)}
                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 8, background: 'white', color: '#374151', cursor: 'pointer', fontSize: '0.875rem' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  localStorage.setItem(PREFS_KEY, JSON.stringify({ defaultView: draftView }));
                  setView(draftView);
                  setAnchor(VIEWS[draftView].unit === 'day' ? startOfWeek(new Date()) : startOfMonth(new Date()));
                  setCustomizeOpen(false);
                }}
                style={{ padding: '0.5rem 1.25rem', border: 'none', borderRadius: 8, background: '#002356', color: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const LegendChip: React.FC<{ color: { bg: string; border: string; color: string }; children: React.ReactNode }> = ({ color, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span style={{ display: 'inline-block', width: 24, height: 14, background: color.bg, border: `1px solid ${color.border}`, borderRadius: 3 }} />
    {children}
  </span>
);

export default LaborCalendar;
