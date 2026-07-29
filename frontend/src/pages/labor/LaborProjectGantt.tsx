import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import TuneIcon from '@mui/icons-material/Tune';
import { laborApi, AssignmentRecord } from '../../services/labor';
import { projectsApi, Project } from '../../services/projects';
import '../../styles/SalesPipeline.css';
import '../Dashboard.css';

type ViewKey = '1w' | '2w' | '4w' | '1mo' | '3mo' | '6mo' | '1y' | '18mo' | '2y';
interface ViewDef { label: string; days: number; unit: 'day' | 'week' | 'month'; cellWidth: number; }

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

const PREFS_KEY = 'labor_project_gantt_prefs';
const PROJECT_COL_WIDTH = 240;
const ROW_HEIGHT = 44;
const HEADER_TOP = 22;
const HEADER_BOTTOM = 30;
const HEADER_HEIGHT = HEADER_TOP + HEADER_BOTTOM;
const DAY_MS = 86400000;

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

const loadPrefs = (): { defaultView: ViewKey } => {
  try { const raw = localStorage.getItem(PREFS_KEY); if (raw) return { defaultView: '6mo', ...JSON.parse(raw) } as { defaultView: ViewKey }; } catch {}
  return { defaultView: '6mo' };
};

interface ProjectRow {
  project_id: number;
  project_name: string;
  project_number: string;
  pm_name: string;
  project_start: Date | null;
  project_end: Date | null;
  labor_start: Date | null;
  labor_end: Date | null;
  crew_count: number;
  assignments: AssignmentRecord[];
}

const LaborProjectGantt: React.FC = () => {
  const [view, setView] = useState<ViewKey>(() => loadPrefs().defaultView);
  const viewDef = VIEWS[view];
  const [anchor, setAnchor] = useState<Date>(() => {
    const v = loadPrefs().defaultView;
    return VIEWS[v].unit === 'day' ? startOfWeek(new Date()) : startOfMonth(new Date());
  });
  const [pmFilter, setPmFilter] = useState('');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [draftView, setDraftView] = useState<ViewKey>('6mo');

  const viewStart = startOfDay(anchor);
  const viewEnd = addDays(viewStart, viewDef.days - 1);
  const from = isoDate(viewStart);
  const to = isoDate(viewEnd);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['labor-calendar', from, to, undefined, undefined],
    queryFn: () => laborApi.getCalendar(from, to, {}),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', { status: 'active' }],
    queryFn: () => projectsApi.getAll({ status: 'active' }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const pmNames = useMemo(() => {
    const s = new Set<string>();
    projects.forEach((p: Project) => { if (p.manager_name) s.add(p.manager_name); });
    return [...s].sort();
  }, [projects]);

  const projectMap = useMemo(() => {
    const m = new Map<number, Project>();
    projects.forEach((p: Project) => m.set(p.id, p));
    return m;
  }, [projects]);

  const projectRows = useMemo((): ProjectRow[] => {
    const map = new Map<number, ProjectRow>();
    for (const a of rows) {
      if (!map.has(a.project_id)) {
        const proj = projectMap.get(a.project_id);
        map.set(a.project_id, {
          project_id: a.project_id,
          project_name: a.project_name || '',
          project_number: a.project_number || '',
          pm_name: proj?.manager_name || '',
          project_start: proj?.start_date ? startOfDay(new Date(proj.start_date)) : null,
          project_end: proj?.end_date ? startOfDay(new Date(proj.end_date)) : null,
          labor_start: null,
          labor_end: null,
          crew_count: 0,
          assignments: [],
        });
      }
      const row = map.get(a.project_id)!;
      if (a.start_date) {
        const s = startOfDay(new Date(a.start_date));
        if (!row.labor_start || s < row.labor_start) row.labor_start = s;
      }
      if (a.end_date) {
        const e = startOfDay(new Date(a.end_date));
        if (!row.labor_end || e > row.labor_end) row.labor_end = e;
      }
      row.crew_count++;
      row.assignments.push(a);
    }
    let result = [...map.values()].sort((a, b) => a.project_name.localeCompare(b.project_name));
    if (pmFilter) result = result.filter((r) => r.pm_name === pmFilter);
    return result;
  }, [rows, projectMap, pmFilter]);

  // ── Scale / header calculation (same as LaborCalendar) ─────────────
  const { pxPerDay, timelineWidth, superMarkers, subMarkers, gridLines } = useMemo(() => {
    let _pxPerDay = 0;
    const supers: { label: string; left: number; width: number }[] = [];
    const subs: { label: string; left: number; width: number; isWeekend?: boolean }[] = [];
    const lines: number[] = [];

    const pushSuper = (d: Date, left: number, w: number) => {
      const label = viewDef.unit === 'month'
        ? d.toLocaleDateString('en-US', { year: 'numeric' })
        : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const last = supers[supers.length - 1];
      if (last && last.label === label) { last.width = left + w - last.left; }
      else { supers.push({ label, left, width: w }); }
    };

    if (viewDef.unit === 'day') {
      _pxPerDay = viewDef.cellWidth;
      for (let i = 0; i < viewDef.days; i++) {
        const d = addDays(viewStart, i); const dow = d.getDay(); const left = i * _pxPerDay;
        subs.push({ label: `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getMonth() + 1}/${d.getDate()}`, left, width: _pxPerDay, isWeekend: dow === 0 || dow === 6 });
        pushSuper(d, left, _pxPerDay);
        if (i > 0) lines.push(left);
      }
    } else if (viewDef.unit === 'week') {
      _pxPerDay = viewDef.cellWidth / 7;
      let cursor = startOfWeek(viewStart);
      while (cursor <= viewEnd) {
        const startOffsetDays = daysBetween(viewStart, cursor);
        const left = startOffsetDays * _pxPerDay; const width = 7 * _pxPerDay;
        subs.push({ label: `${cursor.getMonth() + 1}/${cursor.getDate()}`, left, width });
        for (let i = 0; i < 7; i++) { const day = addDays(cursor, i); if (day > viewEnd) break; pushSuper(day, left + i * _pxPerDay, _pxPerDay); }
        if (startOffsetDays > 0) lines.push(left);
        cursor = addDays(cursor, 7);
      }
    } else {
      _pxPerDay = viewDef.cellWidth / 30;
      let cursor = startOfMonth(viewStart);
      while (cursor <= viewEnd) {
        const next = addMonths(cursor, 1); const monthDays = daysBetween(cursor, next);
        const startOffsetDays = daysBetween(viewStart, cursor); const left = startOffsetDays * _pxPerDay; const width = monthDays * _pxPerDay;
        subs.push({ label: cursor.toLocaleDateString('en-US', { month: 'short' }), left, width });
        pushSuper(cursor, left, width);
        if (startOffsetDays > 0) lines.push(left);
        cursor = next;
      }
    }
    return { pxPerDay: _pxPerDay, timelineWidth: viewDef.days * _pxPerDay, superMarkers: supers, subMarkers: subs, gridLines: lines };
  }, [viewDef, viewStart, viewEnd]);

  const todayLineLeft = (() => {
    const today = startOfDay(new Date());
    if (today < viewStart || today > viewEnd) return null;
    return daysBetween(viewStart, today) * pxPerDay;
  })();

  const navigate = (direction: -1 | 0 | 1) => {
    if (direction === 0) { setAnchor(viewDef.unit === 'day' ? startOfWeek(new Date()) : startOfMonth(new Date())); return; }
    if (viewDef.unit === 'day') { setAnchor(addDays(anchor, direction * viewDef.days)); }
    else if (viewDef.unit === 'week') { setAnchor(addDays(anchor, direction * Math.max(7, Math.floor(viewDef.days / 4)))); }
    else { setAnchor(addMonths(anchor, direction * Math.max(1, Math.floor(viewDef.days / 60)))); }
  };

  const barPos = (start: Date | null, end: Date | null) => {
    if (!start) return null;
    const clampedStart = start < viewStart ? viewStart : start;
    const clampedEnd = (end || viewEnd) > viewEnd ? viewEnd : (end || viewEnd);
    if (clampedEnd < viewStart || clampedStart > viewEnd) return null;
    const offsetDays = daysBetween(viewStart, clampedStart);
    const durDays = daysBetween(clampedStart, clampedEnd) + 1;
    return {
      left: offsetDays * pxPerDay,
      width: Math.max(4, durDays * pxPerDay),
      extendsLeft: start < viewStart,
      extendsRight: (end || viewEnd) > viewEnd,
    };
  };

  return (
    <div className="sales-container">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/labor" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>← Back to Labor Board</Link>
            <h1>🏗️ Project Timeline</h1>
            <div className="sales-subtitle">All active projects with crew coverage at a glance.</div>
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
          <button className="customize-button" onClick={() => { setDraftView(loadPrefs().defaultView); setCustomizeOpen(true); }} title="Customize defaults">
            <TuneIcon fontSize="small" /><span>Customize</span>
          </button>
        </div>
      </div>

      {/* View switcher tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1rem' }}>
        <Link to="/labor/calendar" style={tabStyle(false)}>👤 People</Link>
        <span style={tabStyle(true)}>🏗️ Projects</span>
      </div>

      {/* PM filter */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4 }}>PM</span>
        <button onClick={() => setPmFilter('')} style={{ ...pillBtn, background: !pmFilter ? '#002356' : 'white', color: !pmFilter ? 'white' : '#475569', borderColor: !pmFilter ? '#002356' : '#cbd5e1' }}>All</button>
        {pmNames.map((pm) => (
          <button key={pm} onClick={() => setPmFilter(pm === pmFilter ? '' : pm)} style={{ ...pillBtn, background: pmFilter === pm ? '#002356' : 'white', color: pmFilter === pm ? 'white' : '#475569', borderColor: pmFilter === pm ? '#002356' : '#cbd5e1' }}>
            {pm}
          </button>
        ))}
      </div>

      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 8 }}>
        Showing {viewStart.toLocaleDateString()} → {viewEnd.toLocaleDateString()} · {projectRows.length} project{projectRows.length !== 1 ? 's' : ''}
      </div>

      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : projectRows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No projects with assignments in this range.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: PROJECT_COL_WIDTH + timelineWidth, position: 'relative' }}>
              {/* Header */}
              <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ width: PROJECT_COL_WIDTH, padding: '0 0.75rem', fontSize: '0.7rem', textTransform: 'uppercase', color: '#475569', fontWeight: 700, letterSpacing: 0.5, borderRight: '1px solid #e2e8f0', boxSizing: 'border-box', display: 'flex', alignItems: 'flex-end', paddingBottom: 8, height: HEADER_HEIGHT }}>
                  Project
                </div>
                <div style={{ width: timelineWidth, height: HEADER_HEIGHT, position: 'relative' }}>
                  {superMarkers.map((m, i) => (
                    <div key={`super-${i}`} style={{ position: 'absolute', left: m.left, width: m.width, top: 0, height: HEADER_TOP, borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#1e293b', background: i % 2 === 0 ? '#f8fafc' : '#eef2f7', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '0 4px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</span>
                    </div>
                  ))}
                  {subMarkers.map((m, i) => (
                    <div key={`sub-${i}`} style={{ position: 'absolute', left: m.left, width: m.width, top: HEADER_TOP, height: HEADER_BOTTOM, borderRight: '1px solid #e2e8f0', background: m.isWeekend ? '#f1f5f9' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', color: '#475569', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Today line */}
              {todayLineLeft != null && (
                <div style={{ position: 'absolute', top: HEADER_HEIGHT + 2, bottom: 0, left: PROJECT_COL_WIDTH + todayLineLeft, width: 2, background: '#ef4444', pointerEvents: 'none', zIndex: 5 }} />
              )}

              {/* Project rows */}
              {projectRows.map((pr) => {
                const projPos = barPos(pr.project_start, pr.project_end);
                const laborPos = barPos(pr.labor_start, pr.labor_end);

                // Determine if labor end is after project end (overrun) or well before (gap)
                const laborEndsLate = pr.labor_end && pr.project_end && pr.labor_end > pr.project_end;
                const laborEndsEarly = pr.labor_end && pr.project_end && pr.labor_end < addDays(pr.project_end, -14);

                return (
                  <div key={pr.project_id} style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', height: ROW_HEIGHT }}>
                    {/* Left label */}
                    <div style={{ width: PROJECT_COL_WIDTH, padding: '0 0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: '1px solid #e2e8f0', boxSizing: 'border-box', background: 'white', gap: 2 }}>
                      <Link to={`/projects/${pr.project_id}`} style={{ color: '#002356', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pr.project_number ? `${pr.project_number} — ` : ''}{pr.project_name}
                      </Link>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pr.pm_name && <span>{pr.pm_name} · </span>}
                        <span>{pr.crew_count} crew</span>
                        {laborEndsLate && <span style={{ color: '#dc2626', fontWeight: 600 }}> · labor overruns</span>}
                        {laborEndsEarly && <span style={{ color: '#f59e0b', fontWeight: 600 }}> · labor ends early</span>}
                      </div>
                    </div>

                    {/* Timeline cell */}
                    <div style={{ width: timelineWidth, height: ROW_HEIGHT, position: 'relative' }}>
                      {gridLines.map((x, i) => (
                        <div key={i} style={{ position: 'absolute', left: x, top: 0, bottom: 0, width: 1, background: '#f1f5f9' }} />
                      ))}

                      {/* Project span — thin background bar */}
                      {projPos && (
                        <div
                          title={`Project: ${pr.project_start?.toLocaleDateString() || '?'} → ${pr.project_end?.toLocaleDateString() || 'open'}`}
                          style={{ position: 'absolute', left: projPos.left, width: projPos.width, top: ROW_HEIGHT / 2 - 3, height: 6, background: '#e2e8f0', borderRadius: 3, borderLeftWidth: projPos.extendsLeft ? 0 : undefined, borderRightWidth: projPos.extendsRight ? 0 : undefined }}
                        />
                      )}

                      {/* Labor span — solid foreground bar */}
                      {laborPos && (
                        <Link
                          to={`/projects/${pr.project_id}`}
                          title={`Labor: ${pr.labor_start?.toLocaleDateString() || '?'} → ${pr.labor_end?.toLocaleDateString() || 'open'}\n${pr.crew_count} crew assigned`}
                          style={{
                            position: 'absolute',
                            left: laborPos.left + 1,
                            width: Math.max(4, laborPos.width - 2),
                            top: 8, bottom: 8,
                            background: laborEndsLate ? '#fee2e2' : '#dbeafe',
                            border: `1px solid ${laborEndsLate ? '#dc2626' : '#1d4ed8'}`,
                            borderLeftWidth: laborPos.extendsLeft ? 0 : 1,
                            borderRightWidth: laborPos.extendsRight ? 0 : 1,
                            borderRadius: 4,
                            color: laborEndsLate ? '#991b1b' : '#1e3a8a',
                            fontSize: '0.72rem', fontWeight: 600,
                            padding: '0 6px',
                            display: 'flex', alignItems: 'center',
                            overflow: 'hidden', textDecoration: 'none',
                            whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {pr.crew_count} crew
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: 8, fontSize: '0.75rem', color: '#64748b', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 24, height: 6, background: '#e2e8f0', borderRadius: 3 }} /> Project dates
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 24, height: 14, background: '#dbeafe', border: '1px solid #1d4ed8', borderRadius: 3 }} /> Labor span
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 24, height: 14, background: '#fee2e2', border: '1px solid #dc2626', borderRadius: 3 }} /> Labor overruns project end
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 2, height: 14, background: '#ef4444' }} /> Today
        </span>
      </div>

      {/* Customize drawer */}
      {customizeOpen && (
        <>
          <div onClick={() => setCustomizeOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 1000 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', zIndex: 1001, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TuneIcon style={{ color: '#6b7280', fontSize: '1.25rem' }} />
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>Preferences</span>
              </div>
              <button onClick={() => setCustomizeOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.25rem' }}>×</button>
            </div>
            <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Default View</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {(Object.keys(VIEWS) as ViewKey[]).map((k) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', borderRadius: 8, cursor: 'pointer', background: draftView === k ? '#eff6ff' : 'transparent', border: `1px solid ${draftView === k ? '#bfdbfe' : 'transparent'}`, fontSize: '0.875rem', color: draftView === k ? '#1d4ed8' : '#374151', fontWeight: draftView === k ? 600 : 400 }}>
                    <input type="radio" name="pgDefaultView" value={k} checked={draftView === k} onChange={() => setDraftView(k)} style={{ accentColor: '#1d4ed8' }} />
                    {VIEWS[k].label}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button onClick={() => setCustomizeOpen(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 8, background: 'white', color: '#374151', cursor: 'pointer', fontSize: '0.875rem' }}>Cancel</button>
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

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  fontWeight: active ? 700 : 500,
  color: active ? '#002356' : '#64748b',
  textDecoration: 'none',
  borderBottom: active ? '2px solid #002356' : '2px solid transparent',
  marginBottom: '-2px',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  display: 'inline-block',
});

const pillBtn: React.CSSProperties = {
  padding: '0.25rem 0.75rem', borderRadius: 999,
  fontSize: '0.75rem', fontWeight: 500,
  border: '1px solid #cbd5e1', cursor: 'pointer',
};

export default LaborProjectGantt;
