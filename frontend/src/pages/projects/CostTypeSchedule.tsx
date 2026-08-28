import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  scheduleSegmentsService,
  SEGMENT_DEFINITIONS,
  type ScheduleSegment,
  type SegmentCosts,
} from '../../services/scheduleSegments';
import { getContourMultipliers, contourOptions, ContourVisual, type ContourType } from '../../utils/contours';

// ─── Constants ────────────────────────────────────────────────────────────────

const COL_GROUP = {
  sched: { hdr: '#eef2f7', cell: '#eef2f7' },
  est:   { hdr: '#dbeafe', cell: '#eff6ff' },
  jtd:   { hdr: '#fef3c7', cell: '#fffbeb' },
  proj:  { hdr: '#dcfce7', cell: '#f0fdf4' },
  rem:   { hdr: '#ede9fe', cell: '#f5f3ff' },
};

const SEGMENT_COLOR: Record<string, string> = {
  '30': '#3b82f6', '35': '#3b82f6',
  '40': '#0ea5e9', '45': '#0ea5e9',
  '50': '#06b6d4', '55': '#06b6d4',
  '70': '#64748b', bas: '#8b5cf6',
  material: '#10b981', subcontract: '#f59e0b',
  rental: '#8b5cf6', equipment: '#ef4444', gc: '#6b7280',
};

const ROW_H = 36;
const GROUP_H = 26;

const GANTT_COL_DEFAULTS = { label: 220, estHrs: 62, estCost: 78, start: 90, end: 90, dur: 48, contour: 72 };
type GanttColKey = keyof typeof GANTT_COL_DEFAULTS;
const LEFT_PANEL_DEFAULT = Object.values(GANTT_COL_DEFAULTS).reduce((a, b) => a + b, 0);

// ─── Utilities ────────────────────────────────────────────────────────────────

const toInput = (d: string | null | undefined) => (d ? d.slice(0, 10) : '');

const fmtDateShort = (s: string | null | undefined): string => {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
};

const fmtCompact = (v: number | null | undefined) => {
  if (!v) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v)}`;
};

const fmt$ = (v: number | null | undefined) => v ? `$${Math.round(v).toLocaleString()}` : '—';
const fmtK = (v: number | null | undefined) => v ? `$${Math.round(v / 1000).toLocaleString()}k` : '—';
const fmtHrs = (v: number | null | undefined) => v ? Math.round(v).toLocaleString() : '—';

const calcDur = (start: string | null, end: string | null): string => {
  if (!start || !end) return '—';
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  if (days < 0) return '—';
  const months = Math.round(days / 30.44);
  return months >= 2 ? `${months}mo` : `${days}d`;
};

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function distributeMonthly(
  remaining: number | null,
  startDate: string | null,
  endDate: string | null,
  contourType: string,
  allMonths: Date[]
): number[] {
  if (!remaining || !startDate || !endDate) return allMonths.map(() => 0);
  const start = new Date(startDate), end = new Date(endDate);
  const segIdx: number[] = [];
  allMonths.forEach((m, i) => {
    const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    if (m <= end && mEnd > start) segIdx.push(i);
  });
  if (segIdx.length === 0) return allMonths.map(() => 0);
  const mults = getContourMultipliers(segIdx.length, contourType as ContourType);
  const mSum = mults.reduce((a, b) => a + b, 0) || 1;
  const result = allMonths.map(() => 0);
  segIdx.forEach((idx, i) => { result[idx] = (mults[i] / mSum) * remaining; });
  return result;
}

function dateToX(d: Date, firstMonth: Date, colWidth: number): number {
  const mIdx = (d.getFullYear() - firstMonth.getFullYear()) * 12 + (d.getMonth() - firstMonth.getMonth());
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return mIdx * colWidth + ((d.getDate() - 1) / daysInMonth) * colWidth;
}

function xToDate(x: number, firstMonth: Date, colWidth: number): Date {
  const mIdx = Math.max(0, Math.floor(x / colWidth));
  const remainder = x - mIdx * colWidth;
  const totalM = firstMonth.getMonth() + mIdx;
  const year = firstMonth.getFullYear() + Math.floor(totalM / 12);
  const month = totalM % 12;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.max(1, Math.min(Math.round((remainder / colWidth) * daysInMonth) + 1, daysInMonth));
  return new Date(year, month, day);
}

// ─── Row-level date/contour state ─────────────────────────────────────────────

function useRowEdit(
  seg: ScheduleSegment | undefined,
  defKey: string,
  onSave: (key: string, data: { start_date: string | null; end_date: string | null; contour_type?: string }) => void
) {
  const [localStart,   setLocalStart]   = useState(() => toInput(seg?.start_date));
  const [localEnd,     setLocalEnd]     = useState(() => toInput(seg?.end_date));
  const [localContour, setLocalContour] = useState(() => seg?.contour_type || 'flat');

  useEffect(() => { setLocalStart(toInput(seg?.start_date)); }, [seg?.start_date]);
  useEffect(() => { setLocalEnd(toInput(seg?.end_date)); }, [seg?.end_date]);
  useEffect(() => { setLocalContour(seg?.contour_type || 'flat'); }, [seg?.contour_type]);

  const handleBlur = useCallback(() => {
    const ns = localStart || null, ne = localEnd || null;
    if (ns !== toInput(seg?.start_date) || ne !== toInput(seg?.end_date))
      onSave(defKey, { start_date: ns, end_date: ne, contour_type: localContour });
  }, [defKey, localStart, localEnd, localContour, seg, onSave]);

  const handleContour = useCallback((c: string) => {
    setLocalContour(c);
    onSave(defKey, { start_date: localStart || null, end_date: localEnd || null, contour_type: c });
  }, [defKey, localStart, localEnd, onSave]);

  return { localStart, localEnd, localContour, setLocalStart, setLocalEnd, handleBlur, handleContour };
}

// ─── Left panel row (Gantt mode) ──────────────────────────────────────────────

const GanttLeftRow: React.FC<{
  def: typeof SEGMENT_DEFINITIONS[0];
  seg: ScheduleSegment | undefined;
  costs: SegmentCosts | undefined;
  isActive: boolean;
  rowBg: string;
  color: string;
  colWidths: typeof GANTT_COL_DEFAULTS;
  onSave: (key: string, data: { start_date: string | null; end_date: string | null; contour_type?: string }) => void;
}> = ({ def, seg, costs, isActive, rowBg, color, colWidths, onSave }) => {
  const { localStart, localEnd, localContour, setLocalStart, setLocalEnd, handleBlur, handleContour } = useRowEdit(seg, def.key, onSave);

  const cell: React.CSSProperties = { borderRight: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', height: '100%', fontSize: '0.7rem', color: '#1e293b', flexShrink: 0, overflow: 'hidden' };
  const inputSt: React.CSSProperties = { width: '100%', padding: '0 0.25rem', border: 'none', fontSize: '0.7rem', fontFamily: 'inherit', color: '#1e293b', background: 'transparent', outline: 'none', boxSizing: 'border-box', height: '100%' };

  return (
    <div style={{ height: ROW_H, borderBottom: '1px solid #cbd5e1', display: 'flex', alignItems: 'stretch', background: rowBg, opacity: isActive ? 1 : 0.5 }}>
      {/* Label */}
      <div style={{ ...cell, flex: 1, minWidth: colWidths.label, padding: '0 0.4rem', gap: 6, borderLeft: `3px solid ${def.isLabor ? '#3b82f6' : '#10b981'}` }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{def.label}</span>
        <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontFamily: 'monospace', flexShrink: 0 }}>{def.key.toUpperCase()}</span>
      </div>
      {/* Est Hrs */}
      <div style={{ ...cell, width: colWidths.estHrs, justifyContent: 'center', fontSize: '0.65rem' }}>
        {def.isLabor ? fmtHrs(costs?.est_hours) : '—'}
      </div>
      {/* Est $ */}
      <div style={{ ...cell, width: colWidths.estCost, justifyContent: 'center' }}>
        {fmtCompact(costs?.est_cost)}
      </div>
      {/* Start */}
      <div style={{ ...cell, width: colWidths.start, justifyContent: 'center', position: 'relative', cursor: 'pointer' }}>
        <span style={{ fontSize: '0.7rem', color: localStart ? '#1e293b' : '#94a3b8', pointerEvents: 'none' }}>
          {fmtDateShort(localStart) || '—'}
        </span>
        <input type="date" value={localStart} onChange={e => setLocalStart(e.target.value)} onBlur={handleBlur}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
      </div>
      {/* End */}
      <div style={{ ...cell, width: colWidths.end, justifyContent: 'center', position: 'relative', cursor: 'pointer' }}>
        <span style={{ fontSize: '0.7rem', color: localEnd ? '#1e293b' : '#94a3b8', pointerEvents: 'none' }}>
          {fmtDateShort(localEnd) || '—'}
        </span>
        <input type="date" value={localEnd} onChange={e => setLocalEnd(e.target.value)} onBlur={handleBlur}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }} />
      </div>
      {/* Dur */}
      <div style={{ ...cell, width: colWidths.dur, justifyContent: 'center', fontSize: '0.65rem', color: '#64748b' }}>
        {calcDur(localStart || null, localEnd || null)}
      </div>
      {/* Contour */}
      <div style={{ width: colWidths.contour, flexShrink: 0, display: 'flex', alignItems: 'center', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 0.2rem', width: '100%' }}>
          <ContourVisual contour={localContour as ContourType} />
          <select value={localContour} onChange={e => handleContour(e.target.value)}
            style={{ ...inputSt, cursor: 'pointer', flex: 1 }}>
            {contourOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
};

// ─── Table Row ($ Cost mode) ──────────────────────────────────────────────────

const TableRow: React.FC<{
  def: typeof SEGMENT_DEFINITIONS[0];
  seg: ScheduleSegment | undefined;
  costs: SegmentCosts | undefined;
  isActive: boolean;
  rowBg: string;
  color: string;
  allMonths: Date[];
  onSave: (key: string, data: { start_date: string | null; end_date: string | null; contour_type?: string }) => void;
}> = ({ def, seg, costs, isActive, rowBg, color, allMonths, onSave }) => {
  const { localStart, localEnd, localContour, setLocalStart, setLocalEnd, handleBlur, handleContour } = useRowEdit(seg, def.key, onSave);
  const remaining = (costs?.projected_cost ?? 0) - (costs?.jtd_cost ?? 0);
  const monthly = distributeMonthly(remaining > 0 ? remaining : null, localStart || null, localEnd || null, localContour, allMonths);

  const thSt = (bg: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
    height: 28, padding: '0.15rem 0.3rem', fontSize: '0.68rem', fontWeight: 600, color: '#1e293b',
    background: bg, whiteSpace: 'nowrap', textAlign: 'center', borderBottom: '1px solid #94a3b8',
    borderRight: '1px solid #cbd5e1', verticalAlign: 'middle', position: 'sticky', top: 0, zIndex: 2, ...extra,
  });
  const tdSt = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    height: 28, padding: '0 0.3rem', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
    verticalAlign: 'middle', fontSize: '0.75rem', color: '#1e293b', ...extra,
  });

  return (
    <tr style={{ background: rowBg, opacity: isActive ? 1 : 0.5 }}>
      <td style={{ ...tdSt({ padding: '0 0.5rem', position: 'sticky', left: 0, zIndex: 2, background: rowBg }), borderLeft: `3px solid ${def.isLabor ? '#3b82f6' : '#10b981'}`, borderRight: '2px solid #94a3b8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: isActive ? 600 : 400, color: isActive ? '#1e293b' : '#64748b' }}>{def.label}</div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontFamily: 'monospace' }}>{def.key.toUpperCase()}</div>
          </div>
        </div>
      </td>
      <td style={tdSt({ padding: '0 0.25rem', background: COL_GROUP.sched.hdr + '55' })}>
        <input type="date" value={localStart} onChange={e => setLocalStart(e.target.value)} onBlur={handleBlur}
          style={{ padding: '0.15rem 0.25rem', border: '1px solid #cbd5e1', borderRadius: 3, fontSize: '0.72rem', color: '#1e293b', background: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }} />
      </td>
      <td style={tdSt({ padding: '0 0.25rem', background: COL_GROUP.sched.hdr + '55' })}>
        <input type="date" value={localEnd} onChange={e => setLocalEnd(e.target.value)} onBlur={handleBlur}
          style={{ padding: '0.15rem 0.25rem', border: '1px solid #cbd5e1', borderRadius: 3, fontSize: '0.72rem', color: '#1e293b', background: '#fff', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }} />
      </td>
      <td style={tdSt({ textAlign: 'center', color: '#64748b', background: COL_GROUP.sched.hdr + '55' })}>{calcDur(localStart || null, localEnd || null)}</td>
      <td style={tdSt({ padding: '0 0.2rem', background: COL_GROUP.sched.hdr + '55', borderRight: '2px solid #94a3b8' })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ContourVisual contour={localContour as ContourType} />
          <select value={localContour} onChange={e => handleContour(e.target.value)}
            style={{ padding: '0 0.2rem', fontSize: '0.68rem', border: 'none', background: 'transparent', color: '#1e293b', fontFamily: 'inherit', cursor: 'pointer', width: '100%', outline: 'none' }}>
            {contourOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </td>
      <td style={tdSt({ textAlign: 'right', background: COL_GROUP.est.cell })}>{fmt$(costs?.est_cost)}</td>
      <td style={tdSt({ textAlign: 'right', background: COL_GROUP.est.cell, borderRight: '2px solid #94a3b8' })}>{def.isLabor ? fmtHrs(costs?.est_hours) : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
      <td style={tdSt({ textAlign: 'right', background: COL_GROUP.jtd.cell })}>{fmt$(costs?.jtd_cost)}</td>
      <td style={tdSt({ textAlign: 'right', background: COL_GROUP.jtd.cell, borderRight: '2px solid #94a3b8' })}>{def.isLabor ? fmtHrs(costs?.jtd_hours) : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
      <td style={tdSt({ textAlign: 'right', background: COL_GROUP.proj.cell, borderRight: '2px solid #94a3b8' })}><span style={{ fontWeight: 600 }}>{fmt$(costs?.projected_cost)}</span></td>
      <td style={tdSt({ textAlign: 'right', background: COL_GROUP.rem.cell, borderRight: '2px solid #94a3b8' })}><span style={{ fontWeight: 600, color: remaining < 0 ? '#dc2626' : '#1e293b' }}>{costs?.projected_cost != null ? fmt$(remaining) : '—'}</span></td>
      {allMonths.map((_, i) => {
        const val = monthly[i];
        const bg = i % 2 === 0 ? rowBg : (rowBg === '#fff' ? '#f8fafc' : '#f1f5f9');
        return (
          <td key={i} style={tdSt({ textAlign: 'right', padding: '0 0.25rem', background: bg, color: val > 0 ? color : '#cbd5e1', fontWeight: val > 0 ? 500 : 400 })}>
            {val > 500 ? fmtK(val) : val > 0 ? `$${Math.round(val).toLocaleString()}` : ''}
          </td>
        );
      })}
    </tr>
  );
};

// ─── CostTypeSchedule ─────────────────────────────────────────────────────────

interface Props {
  projectId: number;
  segments: ScheduleSegment[];
  activeKeys: string[];
  onSegmentUpdate: (key: string, data: { start_date: string | null; end_date: string | null; contour_type?: string }) => void;
  onInitialize: () => void;
  initPending: boolean;
}

const CostTypeSchedule: React.FC<Props> = ({
  projectId, segments, activeKeys, onSegmentUpdate, onInitialize, initPending,
}) => {
  const [viewMode, setViewMode] = useState<'gantt' | 'table'>('gantt');

  // ── Column widths ─────────────────────────────────────────────────────────
  const [colWidths, setColWidths] = useState<typeof GANTT_COL_DEFAULTS>(() => {
    try { const s = localStorage.getItem('costTypeSchedule_ganttCols'); return s ? { ...GANTT_COL_DEFAULTS, ...JSON.parse(s) } : GANTT_COL_DEFAULTS; }
    catch { return GANTT_COL_DEFAULTS; }
  });
  const colWidthsRef = useRef(colWidths);
  useEffect(() => { localStorage.setItem('costTypeSchedule_ganttCols', JSON.stringify(colWidths)); }, [colWidths]);

  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    try { const s = localStorage.getItem('costTypeSchedule_leftW'); return s ? parseInt(s) : LEFT_PANEL_DEFAULT; }
    catch { return LEFT_PANEL_DEFAULT; }
  });
  useEffect(() => { localStorage.setItem('costTypeSchedule_leftW', String(leftPanelWidth)); }, [leftPanelWidth]);

  // ── Drag refs ─────────────────────────────────────────────────────────────
  const colResizeRef  = useRef<{ col: GanttColKey; startX: number; startW: number } | null>(null);
  const panelDragRef  = useRef<{ startX: number; startW: number } | null>(null);
  const barDragRef    = useRef<{ segKey: string; startMouseX: number; originalBarLeft: number; originalStartDate: Date; originalEndDate: Date; durationDays: number; dragStarted: boolean } | null>(null);
  const barResizeRef  = useRef<{ segKey: string; edge: 'left' | 'right'; startMouseX: number; originalBarLeft: number; originalBarWidth: number; originalStartDate: Date; originalEndDate: Date; dragStarted: boolean } | null>(null);
  const dragOccurred  = useRef(false);

  const [barDragOffset,   setBarDragOffset]   = useState<{ segKey: string; deltaX: number } | null>(null);
  const [barResizeOffset, setBarResizeOffset] = useState<{ segKey: string; edge: 'left' | 'right'; deltaX: number } | null>(null);

  const xToDateRef  = useRef<(x: number) => Date>(() => new Date());
  const onSaveRef   = useRef(onSegmentUpdate);
  onSaveRef.current = onSegmentUpdate;

  // ── Mouse handlers ────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (panelDragRef.current) {
        const diff = e.clientX - panelDragRef.current.startX;
        setLeftPanelWidth(Math.max(200, panelDragRef.current.startW + diff));
      }
      if (colResizeRef.current) {
        const r = colResizeRef.current;
        const newW = Math.max(32, r.startW + (e.clientX - r.startX));
        const delta = newW - ((colWidthsRef.current as any)[r.col] || r.startW);
        setColWidths(prev => { const next = { ...prev, [r.col]: newW }; colWidthsRef.current = next; return next; });
        if (delta !== 0) setLeftPanelWidth(prev => Math.max(200, prev + delta));
      }
      if (barDragRef.current) {
        const d = barDragRef.current;
        const deltaX = e.clientX - d.startMouseX;
        if (!d.dragStarted) { if (Math.abs(deltaX) < 4) return; d.dragStarted = true; document.body.style.cursor = 'grabbing'; document.body.style.userSelect = 'none'; }
        setBarDragOffset({ segKey: d.segKey, deltaX });
      }
      if (barResizeRef.current) {
        const r = barResizeRef.current;
        const deltaX = e.clientX - r.startMouseX;
        if (!r.dragStarted) { if (Math.abs(deltaX) < 4) return; r.dragStarted = true; document.body.style.cursor = r.edge === 'right' ? 'e-resize' : 'w-resize'; document.body.style.userSelect = 'none'; }
        setBarResizeOffset({ segKey: r.segKey, edge: r.edge, deltaX });
      }
    };
    const onUp = (e: MouseEvent) => {
      if (barDragRef.current?.dragStarted) {
        const d = barDragRef.current;
        const newStart = xToDateRef.current(d.originalBarLeft + (e.clientX - d.startMouseX));
        const newEnd   = new Date(newStart.getTime() + d.durationDays * 86400000);
        onSaveRef.current(d.segKey, { start_date: toIso(newStart), end_date: toIso(newEnd) });
        dragOccurred.current = true;
      }
      if (barResizeRef.current?.dragStarted) {
        const r = barResizeRef.current;
        const deltaX = e.clientX - r.startMouseX;
        if (r.edge === 'left') {
          const newStart = xToDateRef.current(r.originalBarLeft + deltaX);
          if (newStart < r.originalEndDate)
            onSaveRef.current(r.segKey, { start_date: toIso(newStart), end_date: toIso(r.originalEndDate) });
        } else {
          const newEnd = xToDateRef.current(r.originalBarLeft + r.originalBarWidth + deltaX);
          if (newEnd > r.originalStartDate)
            onSaveRef.current(r.segKey, { start_date: toIso(r.originalStartDate), end_date: toIso(newEnd) });
        }
        dragOccurred.current = true;
      }
      barDragRef.current   = null; setBarDragOffset(null);
      barResizeRef.current = null; setBarResizeOffset(null);
      colResizeRef.current = null;
      panelDragRef.current = null;
      document.body.style.cursor = ''; document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: costs = [] } = useQuery({
    queryKey: ['schedule-segment-costs', projectId],
    queryFn: () => scheduleSegmentsService.getCosts(projectId),
  });

  const segmentMap = new Map(segments.map(s => [s.segment_key, s]));
  const costsMap   = new Map(costs.map(c => [c.segment_key, c]));
  const hasAnyDates = segments.some(s => s.start_date || s.end_date);

  const totalEst = costs.reduce((s, c) => s + (c.est_cost ?? 0), 0);
  const totalJtd = costs.reduce((s, c) => s + (c.jtd_cost ?? 0), 0);
  const totalRem = costs.reduce((s, c) => s + ((c.projected_cost ?? 0) - (c.jtd_cost ?? 0)), 0);

  // ── Timeline ──────────────────────────────────────────────────────────────
  const allStarts = segments.map(s => s.start_date ? new Date(s.start_date.slice(0, 10)).getTime() : null).filter(Boolean) as number[];
  const allEnds   = segments.map(s => s.end_date   ? new Date(s.end_date.slice(0, 10)).getTime()   : null).filter(Boolean) as number[];
  const tStart = allStarts.length ? Math.min(...allStarts) : Date.now();
  const tEnd   = allEnds.length   ? Math.max(...allEnds)   : tStart + 365 * 86400000;

  const allMonths: Date[] = [];
  const mCur = new Date(tStart); mCur.setDate(1);
  while (mCur.getTime() <= tEnd) { allMonths.push(new Date(mCur)); mCur.setMonth(mCur.getMonth() + 1); }
  const colWidth   = Math.max(52, Math.min(90, Math.floor(600 / (allMonths.length || 1))));
  const firstMonth = allMonths[0] ?? null;
  const totalW     = allMonths.length * colWidth;

  xToDateRef.current = (x: number) => xToDate(x, firstMonth ?? new Date(), colWidth);

  // ── Row items (group headers + segments interleaved) ──────────────────────
  const rowItems: Array<{ type: 'group'; group: string } | { type: 'seg'; def: typeof SEGMENT_DEFINITIONS[0]; idx: number }> = [];
  let lastGroup = '';
  SEGMENT_DEFINITIONS.forEach((def, idx) => {
    const g = def.isLabor ? 'Labor' : 'Non-Labor';
    if (g !== lastGroup) { rowItems.push({ type: 'group', group: g }); lastGroup = g; }
    rowItems.push({ type: 'seg', def, idx });
  });

  // ── Column resize handle ──────────────────────────────────────────────────
  const resizeHandle = (col: GanttColKey) => (
    <div
      onMouseDown={e => {
        e.preventDefault(); e.stopPropagation();
        colResizeRef.current = { col, startX: e.clientX, startW: (colWidthsRef.current as any)[col] || 60 };
        document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
      }}
      style={{ position: 'absolute', right: -1, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 2 }}
      onMouseEnter={e => { (e.target as HTMLElement).style.backgroundColor = 'rgba(59,130,246,0.25)'; }}
      onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
    />
  );

  // ── View toggle ───────────────────────────────────────────────────────────
  const viewBtn = (active: boolean): React.CSSProperties => ({
    padding: '0.3rem 0.6rem', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit',
    background: active ? '#3b82f6' : 'white', color: active ? 'white' : '#1e293b',
  });

  const hdrCell: React.CSSProperties = {
    borderRight: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', fontSize: '0.68rem', fontWeight: 600, color: '#1e293b',
    whiteSpace: 'nowrap', position: 'relative', userSelect: 'none', flexShrink: 0,
  };

  return (
    <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

      {/* Stats bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.9rem' }}>
          {[
            { label: 'Est',   value: fmtCompact(totalEst), color: '#1e293b' },
            { label: 'JTD',   value: fmtCompact(totalJtd), color: '#3b82f6' },
            { label: 'Rem',   value: fmtCompact(totalRem), color: '#10b981' },
            { label: 'Types', value: String(costs.length), color: '#64748b' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase' }}>{s.label}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {!hasAnyDates && (
            <button onClick={onInitialize} disabled={initPending}
              style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontFamily: 'inherit', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#1e293b' }}>
              {initPending ? 'Initializing…' : 'Initialize from Project Dates'}
            </button>
          )}
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <button style={viewBtn(viewMode === 'gantt')} onClick={() => setViewMode('gantt')}>Gantt</button>
            <button style={{ ...viewBtn(viewMode === 'table'), borderLeft: '1px solid #e2e8f0' }} onClick={() => setViewMode('table')}>$ Cost</button>
          </div>
        </div>
      </div>

      {/* ── GANTT VIEW ─────────────────────────────────────────────────────── */}
      {viewMode === 'gantt' && (
        <div style={{ display: 'flex', overflow: 'hidden', border: '1px solid #94a3b8', borderRadius: 6 }}>

          {/* Left panel */}
          <div style={{ width: leftPanelWidth, flexShrink: 0, overflow: 'auto' }}>
            {/* Header */}
            <div style={{ height: ROW_H, display: 'flex', alignItems: 'stretch', background: '#eef2f7', borderBottom: '1px solid #94a3b8', position: 'sticky', top: 0, zIndex: 4 }}>
              <div style={{ ...hdrCell, flex: 1, minWidth: colWidths.label, padding: '0 0.5rem', justifyContent: 'flex-start', borderLeft: '3px solid transparent' }}>
                Cost Type{resizeHandle('label')}
              </div>
              <div style={{ ...hdrCell, width: colWidths.estHrs }}>Est Hrs{resizeHandle('estHrs')}</div>
              <div style={{ ...hdrCell, width: colWidths.estCost }}>Est ${resizeHandle('estCost')}</div>
              <div style={{ ...hdrCell, width: colWidths.start }}>Start{resizeHandle('start')}</div>
              <div style={{ ...hdrCell, width: colWidths.end }}>End{resizeHandle('end')}</div>
              <div style={{ ...hdrCell, width: colWidths.dur }}>Dur{resizeHandle('dur')}</div>
              <div style={{ ...hdrCell, width: colWidths.contour, borderRight: 'none' }}>Contour{resizeHandle('contour')}</div>
            </div>

            {/* Rows */}
            {rowItems.map(item => {
              if (item.type === 'group') return (
                <div key={`lg-${item.group}`} style={{
                  height: GROUP_H, display: 'flex', alignItems: 'center', padding: '0 0.75rem',
                  background: item.group === 'Labor' ? '#eff6ff' : '#f0fdf4',
                  borderTop: '2px solid #94a3b8', borderBottom: '1px solid #e2e8f0',
                  fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: item.group === 'Labor' ? '#1d4ed8' : '#15803d',
                }}>
                  {item.group}
                </div>
              );
              const { def, idx } = item;
              return (
                <GanttLeftRow key={def.key}
                  def={def} seg={segmentMap.get(def.key)} costs={costsMap.get(def.key)}
                  isActive={activeKeys.includes(def.key)} rowBg={idx % 2 === 0 ? '#fff' : '#f8fafc'}
                  color={SEGMENT_COLOR[def.key] ?? '#6b7280'} colWidths={colWidths} onSave={onSegmentUpdate}
                />
              );
            })}
          </div>

          {/* Panel resize divider */}
          <div
            onMouseDown={e => { e.preventDefault(); panelDragRef.current = { startX: e.clientX, startW: leftPanelWidth }; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
            style={{ width: 3, flexShrink: 0, cursor: 'col-resize', background: '#94a3b8', transition: 'background 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#3b82f6'; }}
            onMouseLeave={e => { if (!panelDragRef.current) (e.currentTarget as HTMLElement).style.background = '#94a3b8'; }}
          />

          {/* Right panel — timeline */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ minWidth: totalW }}>
              {/* Month header */}
              <div style={{ display: 'flex', height: ROW_H, borderBottom: '1px solid #94a3b8', background: '#eef2f7', position: 'sticky', top: 0, zIndex: 3 }}>
                {allMonths.map((m, i) => (
                  <div key={i} style={{ width: colWidth, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 600, color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>
                    {m.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })}
                  </div>
                ))}
              </div>

              {/* Bar rows */}
              {rowItems.map(item => {
                if (item.type === 'group') return (
                  <div key={`rg-${item.group}`} style={{
                    height: GROUP_H, borderTop: '2px solid #94a3b8', borderBottom: '1px solid #e2e8f0',
                    background: item.group === 'Labor' ? '#eff6ff' : '#f0fdf4',
                  }}>
                    {allMonths.map((_, i) => (
                      <div key={i} style={{ display: 'inline-block', width: colWidth, height: '100%', borderRight: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
                    ))}
                  </div>
                );

                const { def, idx } = item;
                const seg        = segmentMap.get(def.key);
                const color      = SEGMENT_COLOR[def.key] ?? '#6b7280';
                const rowBg      = idx % 2 === 0 ? '#fff' : '#f8fafc';
                const isActive   = activeKeys.includes(def.key);

                const startDate = seg?.start_date ? new Date(seg.start_date.slice(0, 10)) : null;
                const endDate   = seg?.end_date   ? new Date(seg.end_date.slice(0, 10))   : null;

                let barLeft = 0, barWidth = 0;
                if (startDate && endDate && firstMonth) {
                  barLeft  = dateToX(startDate, firstMonth, colWidth) + 2;
                  const eDays = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
                  barWidth = dateToX(endDate, firstMonth, colWidth) + colWidth / eDays - barLeft;
                }

                const isDragging = barDragOffset?.segKey === def.key;
                const isResizing = barResizeOffset?.segKey === def.key;
                let adjLeft = barLeft + (isDragging ? barDragOffset!.deltaX : 0);
                let adjWidth = barWidth;
                if (isResizing) {
                  if (barResizeOffset!.edge === 'left') { adjLeft = barLeft + barResizeOffset!.deltaX; adjWidth = Math.max(8, barWidth - barResizeOffset!.deltaX); }
                  else { adjWidth = Math.max(8, barWidth + barResizeOffset!.deltaX); }
                }

                return (
                  <div key={def.key} style={{ height: ROW_H, position: 'relative', borderBottom: '1px solid #cbd5e1', background: rowBg, opacity: isActive ? 1 : 0.5 }}>
                    {/* Month stripes */}
                    {allMonths.map((_, i) => (
                      <div key={i} style={{ position: 'absolute', left: i * colWidth, top: 0, bottom: 0, width: colWidth, borderRight: '1px solid #e2e8f0' }} />
                    ))}
                    {/* Bar */}
                    {barWidth > 0 && (
                      <div style={{
                        position: 'absolute', left: adjLeft, top: 4, height: ROW_H - 8, width: adjWidth,
                        backgroundColor: color + '50', border: `2px solid ${color}`, borderRadius: 4,
                        display: 'flex', alignItems: 'center', paddingLeft: 6, paddingRight: 6, overflow: 'hidden',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        zIndex: isDragging || isResizing ? 10 : 1,
                      }}
                        onMouseDown={e => {
                          if (e.button !== 0 || !startDate || !endDate) return;
                          e.stopPropagation();
                          barDragRef.current = {
                            segKey: def.key, startMouseX: e.clientX, originalBarLeft: barLeft,
                            originalStartDate: startDate, originalEndDate: endDate,
                            durationDays: Math.round((endDate.getTime() - startDate.getTime()) / 86400000),
                            dragStarted: false,
                          };
                        }}
                        onMouseEnter={e => { if (!barDragRef.current && !barResizeRef.current) (e.currentTarget as HTMLElement).style.backgroundColor = color + '70'; }}
                        onMouseLeave={e => { if (!barDragRef.current && !barResizeRef.current) (e.currentTarget as HTMLElement).style.backgroundColor = color + '50'; }}
                      >
                        {/* Left resize handle */}
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'w-resize', zIndex: 2 }}
                          onMouseDown={e => {
                            if (e.button !== 0 || !startDate || !endDate) return;
                            e.stopPropagation(); e.preventDefault();
                            barResizeRef.current = { segKey: def.key, edge: 'left', startMouseX: e.clientX, originalBarLeft: barLeft, originalBarWidth: barWidth, originalStartDate: startDate, originalEndDate: endDate, dragStarted: false };
                          }} />
                        <span style={{ fontSize: '0.65rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, pointerEvents: 'none' }}>
                          {def.label}
                        </span>
                        {/* Right resize handle */}
                        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'e-resize', zIndex: 2 }}
                          onMouseDown={e => {
                            if (e.button !== 0 || !startDate || !endDate) return;
                            e.stopPropagation(); e.preventDefault();
                            barResizeRef.current = { segKey: def.key, edge: 'right', startMouseX: e.clientX, originalBarLeft: barLeft, originalBarWidth: barWidth, originalStartDate: startDate, originalEndDate: endDate, dragStarted: false };
                          }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TABLE ($ COST) VIEW ───────────────────────────────────────────── */}
      {viewMode === 'table' && (() => {
        const monthColW = Math.max(48, Math.min(80, Math.floor(500 / (allMonths.length || 1))));
        lastGroup = '';
        return (
          <div style={{ border: '1px solid #94a3b8', borderRadius: 6, overflow: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 220 }} /><col style={{ width: 105 }} /><col style={{ width: 105 }} />
                <col style={{ width: 46 }} /><col style={{ width: 100 }} /><col style={{ width: 82 }} />
                <col style={{ width: 64 }} /><col style={{ width: 80 }} /><col style={{ width: 64 }} />
                <col style={{ width: 82 }} /><col style={{ width: 78 }} />
                {allMonths.map((_, i) => <col key={i} style={{ width: monthColW }} />)}
              </colgroup>
              <thead style={{ position: 'sticky', top: 0, zIndex: 4 }}>
                <tr>
                  {[
                    [COL_GROUP.sched.hdr, 'Cost Type', { textAlign: 'left', padding: '0.15rem 0.6rem', position: 'sticky', left: 0, zIndex: 6, borderRight: '2px solid #94a3b8' }],
                    [COL_GROUP.sched.hdr, 'Start', {}], [COL_GROUP.sched.hdr, 'End', {}],
                    [COL_GROUP.sched.hdr, 'Dur', {}], [COL_GROUP.sched.hdr, 'Contour', { borderRight: '2px solid #94a3b8' }],
                    [COL_GROUP.est.hdr, 'Est Cost', {}], [COL_GROUP.est.hdr, 'Est Hrs', { borderRight: '2px solid #94a3b8' }],
                    [COL_GROUP.jtd.hdr, 'JTD Cost', {}], [COL_GROUP.jtd.hdr, 'JTD Hrs', { borderRight: '2px solid #94a3b8' }],
                    [COL_GROUP.proj.hdr, 'Proj Cost', { borderRight: '2px solid #94a3b8' }],
                    [COL_GROUP.rem.hdr, 'Remaining', { borderRight: '2px solid #94a3b8' }],
                  ].map(([bg, label, extra]: any) => (
                    <th key={label} style={{ height: 28, padding: '0.15rem 0.3rem', fontSize: '0.68rem', fontWeight: 600, color: '#1e293b', background: bg, whiteSpace: 'nowrap', textAlign: 'center', borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1', verticalAlign: 'middle', ...extra }}>
                      {label}
                    </th>
                  ))}
                  {allMonths.map((m, i) => (
                    <th key={i} style={{ height: 28, padding: '0.15rem 0.1rem', fontSize: '0.62rem', fontWeight: 600, color: '#1e293b', background: '#eef2f7', textAlign: 'center', borderBottom: '1px solid #94a3b8', borderRight: '1px solid #cbd5e1', verticalAlign: 'middle' }}>
                      {m.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SEGMENT_DEFINITIONS.map((def, idx) => {
                  const g = def.isLabor ? 'Labor' : 'Non-Labor';
                  const showDiv = g !== lastGroup; lastGroup = g;
                  const totalCols = 11 + allMonths.length;
                  const rowBg = idx % 2 === 0 ? '#fff' : '#f8fafc';
                  return (
                    <React.Fragment key={def.key}>
                      {showDiv && (
                        <tr>
                          <td colSpan={totalCols} style={{ background: g === 'Labor' ? '#eff6ff' : '#f0fdf4', padding: '0.15rem 0.75rem', fontSize: '0.63rem', fontWeight: 700, color: g === 'Labor' ? '#1d4ed8' : '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: '2px solid #94a3b8', borderBottom: '1px solid #e2e8f0' }}>
                            {g}
                          </td>
                        </tr>
                      )}
                      <TableRow def={def} seg={segmentMap.get(def.key)} costs={costsMap.get(def.key)}
                        isActive={activeKeys.includes(def.key)} rowBg={rowBg}
                        color={SEGMENT_COLOR[def.key] ?? '#6b7280'} allMonths={allMonths} onSave={onSegmentUpdate}
                      />
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
};

export default CostTypeSchedule;
