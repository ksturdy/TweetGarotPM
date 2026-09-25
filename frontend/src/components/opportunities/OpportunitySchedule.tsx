import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { getContourMultipliers, contourOptions, ContourVisual, type ContourType } from '../../utils/contours';
import opportunitiesService from '../../services/opportunities';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

// ── Segment definitions (mirrors CostTypeSchedule SEGMENT_DEFINITIONS) ───────
const SEGMENT_DEFS = [
  { key: '30',          label: 'Sheet Metal Field', isLabor: true,  color: '#3b82f6' },
  { key: '35',          label: 'Sheet Metal Shop',  isLabor: true,  color: '#1d4ed8' },
  { key: '40',          label: 'Pipefitter Field',  isLabor: true,  color: '#0ea5e9' },
  { key: '45',          label: 'Pipefitter Shop',   isLabor: true,  color: '#0369a1' },
  { key: '50',          label: 'Plumbing Field',    isLabor: true,  color: '#06b6d4' },
  { key: '55',          label: 'Plumbing Shop',     isLabor: true,  color: '#0e7490' },
  { key: '70',          label: 'Overhead',          isLabor: true,  color: '#64748b' },
  { key: 'material',    label: 'Material',          isLabor: false, color: '#10b981' },
  { key: 'subcontract', label: 'Subcontracts',      isLabor: false, color: '#f59e0b' },
  { key: 'rental',      label: 'Rentals',           isLabor: false, color: '#8b5cf6' },
  { key: 'equipment',   label: 'MEP Equipment',     isLabor: false, color: '#ef4444' },
  { key: 'gc',          label: 'General Conditions',isLabor: false, color: '#6b7280' },
] as const;

type SegKey = typeof SEGMENT_DEFS[number]['key'];


// ── Shift schedule ────────────────────────────────────────────────────────────
type DayKey = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun';
type ShiftDay = Record<DayKey, number>;
const DAY_KEYS: DayKey[] = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LABELS = ['M','T','W','T','F','S','S'];
const DEFAULT_SHIFT: ShiftDay = { mon:8, tue:8, wed:8, thu:8, fri:8, sat:0, sun:0 };
const weeklyHrs = (s: ShiftDay) => DAY_KEYS.reduce((n, d) => n + (s[d] ?? 0), 0);
const hrsPerPersonPerMonth = (s: ShiftDay) => weeklyHrs(s) * (52 / 12);

// ── Gantt constants ───────────────────────────────────────────────────────────
const COL_W = 72; // px per month
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Row state ─────────────────────────────────────────────────────────────────
interface RowState {
  key: SegKey;
  label: string;
  isLabor: boolean;
  color: string;
  start: string;
  end: string;
  contour: ContourType;
  notes: string;
}

// ── Drag ──────────────────────────────────────────────────────────────────────
interface DragInfo {
  key: string; mode: 'move'|'resize-left'|'resize-right';
  startMouseX: number; origStartMs: number; origEndMs: number; started: boolean;
}
interface DragPreview { key: string; startMs: number; endMs: number; }

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  opportunityId: number;
  estimatedValue: number;
  estimatedStartDate?: string;
  estimatedEndDate?: string;
  onProjectDatesChange?: (start: string | null, end: string | null) => void;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
const norm = (s: string | null | undefined): string =>
  s ? s.substring(0, 10) : '';

const parseMs = (s: string): number | null => {
  if (!s || s.length < 10) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d.getTime();
};

const msToIso = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const calcDur = (start: string, end: string): string => {
  if (!start || !end) return '—';
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000);
  if (days < 0) return '—';
  const months = Math.round(days / 30.44);
  return months >= 2 ? `${months}mo` : `${days}d`;
};

const addMonths = (dateStr: string, months: number): string => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + Math.round(months));
  return msToIso(d.getTime());
};

const fmtHrs = (v: number): string => {
  if (!v) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(1)}Kh`;
  return `${Math.round(v)}h`;
};

const fmtCompact = (v: number): string => {
  if (!v) return '—';
  if (v >= 1_000_000) return `$${(v/1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v/1000)}K`;
  return `$${Math.round(v)}`;
};

// ── LocalStorage ──────────────────────────────────────────────────────────────
type ShiftSettings = Record<string, ShiftDay>;
function loadShifts(id: number): ShiftSettings {
  try { const r = localStorage.getItem(`opp_shifts_${id}`); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
function saveShifts(id: number, s: ShiftSettings) {
  localStorage.setItem(`opp_shifts_${id}`, JSON.stringify(s));
}

// ── DurInput (click to enter months) ─────────────────────────────────────────
const DurInput: React.FC<{ start: string; end: string; onChange: (end: string) => void }> = ({ start, end, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const label = calcDur(start, end);
  const commit = () => {
    setEditing(false);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 0 && start) onChange(addMonths(start, n));
  };
  if (editing) return (
    <input type="number" autoFocus min={0} value={val}
      style={{ width: 44, textAlign: 'center', padding: '1px 2px', border: '1px solid #667eea', borderRadius: 3, fontSize: '0.7rem', fontFamily: 'inherit', outline: 'none' }}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
    />
  );
  return (
    <span onClick={() => { const m = calcDur(start, end).replace('mo',''); setVal(m === '—' ? '' : m); setEditing(true); }}
      style={{ cursor: 'pointer', color: label === '—' ? '#cbd5e1' : '#64748b', fontSize: '0.7rem', userSelect: 'none' }}>
      {label}
    </span>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const OpportunitySchedule: React.FC<Props> = ({
  opportunityId, estimatedValue, estimatedStartDate, estimatedEndDate, onProjectDatesChange,
}) => {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<RowState[]>([]);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const initialized = useRef(false);

  // Shift
  const [shifts, setShifts] = useState<ShiftSettings>(() => loadShifts(opportunityId));
  const getShift = (key: string): ShiftDay => shifts[key] ?? { ...DEFAULT_SHIFT };
  const updateShift = (key: string, day: DayKey, val: number) => {
    setShifts(prev => {
      const next = { ...prev, [key]: { ...(prev[key] ?? DEFAULT_SHIFT), [day]: val } };
      saveShifts(opportunityId, next);
      return next;
    });
  };

  // Drag
  const dragRef = useRef<DragInfo | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const dragPreviewRef = useRef<DragPreview | null>(null);
  useEffect(() => { dragPreviewRef.current = dragPreview; }, [dragPreview]);
  const commitFnRef = useRef<(key: string, start: string, end: string) => void>(() => {});

  // Queries
  const { data: savedRows } = useQuery({
    queryKey: ['opportunity-ct-schedule', opportunityId],
    queryFn: () => opportunitiesService.getCostTypeSchedule(opportunityId),
    enabled: !!opportunityId,
  });
  const { data: estimate } = useQuery({
    queryKey: ['opportunity-estimate', opportunityId],
    queryFn: () => opportunitiesService.getEstimate(opportunityId),
    enabled: !!opportunityId,
  });

  // Init from DB
  useEffect(() => {
    if (!savedRows || initialized.current) return;
    initialized.current = true;
    const projStart = norm(estimatedStartDate);
    const projEnd   = norm(estimatedEndDate);
    setRows(SEGMENT_DEFS.map(def => {
      const saved = savedRows.find(r => r.segment_key === def.key);
      return {
        key: def.key as SegKey,
        label: def.label,
        isLabor: def.isLabor,
        color: def.color,
        start: norm(saved?.start_date) || projStart,
        end:   norm(saved?.end_date)   || projEnd,
        contour: (saved?.contour_type || 'flat') as ContourType,
        notes: saved?.notes || '',
      };
    }));
  }, [savedRows]); // intentionally omit estimatedStart/End

  // Keep inherited rows in sync when project dates change
  useEffect(() => {
    if (!initialized.current) return;
    const projStart = norm(estimatedStartDate);
    const projEnd   = norm(estimatedEndDate);
    setRows(prev => prev.map(r => {
      const saved = savedRows?.find(s => s.segment_key === r.key);
      return {
        ...r,
        start: saved?.start_date ? norm(saved.start_date) : projStart,
        end:   saved?.end_date   ? norm(saved.end_date)   : projEnd,
      };
    }));
  }, [estimatedStartDate, estimatedEndDate]);

  // Save
  const saveMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: any }) =>
      opportunitiesService.saveCostTypeScheduleRow(opportunityId, key, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opportunity-ct-schedule', opportunityId] }),
  });
  const debounceSave = useCallback((key: string, start: string, end: string, contour: string, notes: string) => {
    clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      saveMutation.mutate({ key, data: { start_date: start || null, end_date: end || null, contour_type: contour, notes } });
    }, 600);
  }, [saveMutation]);

  const updateRow = useCallback((key: string, patch: Partial<RowState>) => {
    setRows(prev => {
      const next = prev.map(r => r.key !== key ? r : { ...r, ...patch });
      const starts = next.map(r => r.start).filter(Boolean);
      const ends   = next.map(r => r.end).filter(Boolean);
      onProjectDatesChange?.(
        starts.length ? starts.reduce((a, b) => a < b ? a : b) : null,
        ends.length   ? ends.reduce((a, b) => a > b ? a : b) : null,
      );
      const u = next.find(r => r.key === key)!;
      debounceSave(key, u.start, u.end, u.contour, u.notes);
      return next;
    });
  }, [debounceSave, onProjectDatesChange]);

  const commitDates = useCallback((key: string, start: string, end: string) => {
    updateRow(key, { start, end });
  }, [updateRow]);
  useEffect(() => { commitFnRef.current = commitDates; }, [commitDates]);

  const fillMissing = useCallback(() => {
    const projStart = norm(estimatedStartDate);
    const projEnd   = norm(estimatedEndDate);
    if (!projStart && !projEnd) return;
    setRows(prev => {
      const next = prev.map(r => ({
        ...r,
        start: r.start || projStart,
        end:   r.end   || projEnd,
      }));
      next.forEach(r => {
        const orig = prev.find(p => p.key === r.key)!;
        if (r.start !== orig.start || r.end !== orig.end) {
          debounceSave(r.key, r.start, r.end, r.contour, r.notes);
        }
      });
      const starts = next.map(r => r.start).filter(Boolean);
      const ends   = next.map(r => r.end).filter(Boolean);
      onProjectDatesChange?.(
        starts.length ? starts.reduce((a, b) => a < b ? a : b) : null,
        ends.length   ? ends.reduce((a, b) => a > b ? a : b) : null,
      );
      return next;
    });
  }, [estimatedStartDate, estimatedEndDate, debounceSave, onProjectDatesChange]);

  // ── Timeline ──────────────────────────────────────────────────────────────
  const allMonths = useMemo(() => {
    const starts = rows.map(r => parseMs(r.start)).filter(Boolean) as number[];
    const ends   = rows.map(r => parseMs(r.end)).filter(Boolean) as number[];
    if (!starts.length || !ends.length) return [] as Date[];
    const tStart = Math.min(...starts), tEnd = Math.max(...ends);
    const months: Date[] = [];
    const cur = new Date(tStart); cur.setDate(1);
    while (cur.getTime() <= tEnd) { months.push(new Date(cur)); cur.setMonth(cur.getMonth()+1); }
    return months;
  }, [rows]);

  const firstMonth = allMonths[0] ?? null;
  const totalGanttW = allMonths.length * COL_W;

  function getBarGeom(start: string, end: string, preview?: DragPreview | null, key?: string) {
    const s = preview && preview.key === key ? preview.startMs : parseMs(start);
    const e = preview && preview.key === key ? preview.endMs   : parseMs(end);
    if (!s || !e || !firstMonth || e <= s) return null;
    const fMs = firstMonth.getTime();
    const spanMs = totalGanttW ? (allMonths.length * 30.44 * 24 * 3600 * 1000) : 1;
    const left  = Math.max(0, (s - fMs) / (spanMs / totalGanttW));
    const width = Math.max(2, (e - s) / (spanMs / totalGanttW));
    return { left, width };
  }

  // ── Cost amounts (mirrors TitanEstimate calc) ────────────────────────────
  const getCostAmt = useCallback((key: string): number => {
    if (!estimate || !estimatedValue) return 0;
    const e = estimate as any;
    const f = (field: string) => parseFloat(String(e[field])) || 0;
    const marginPct = Math.min(f('margin_pct'), 0.9999);
    const costBase = estimatedValue * (1 - marginPct);
    const laborAmt = costBase * f('labor_pct');
    switch (key) {
      case 'material':    return costBase * f('material_pct');
      case 'subcontract': return costBase * f('subcontracts_pct');
      case 'rental':      return costBase * f('rentals_pct');
      case 'equipment':   return costBase * f('mep_equip_pct');
      case 'gc':          return costBase * f('general_conditions_pct');
      case '30': return laborAmt * f('sm_labor_pct') * f('sm_field_pct');
      case '35': return laborAmt * f('sm_labor_pct') * f('sm_shop_pct');
      case '40': return laborAmt * f('pf_labor_pct') * f('pf_field_pct');
      case '45': return laborAmt * f('pf_labor_pct') * f('pf_shop_pct');
      case '50': return laborAmt * f('pl_labor_pct') * f('pl_field_pct');
      case '55': return laborAmt * f('pl_labor_pct') * f('pl_shop_pct');
      case '70': return laborAmt * Math.max(0, 1 - f('sm_labor_pct') - f('pf_labor_pct') - f('pl_labor_pct'));
      default:   return 0;
    }
  }, [estimate, estimatedValue]);

  const totalEst = useMemo(() => SEGMENT_DEFS.reduce((sum, d) => sum + getCostAmt(d.key), 0), [getCostAmt]);
  const typesWithDates = rows.filter(r => r.start && r.end).length;

  // ── Distribute monthly ────────────────────────────────────────────────────
  function distributeMonthly(amt: number, start: string, end: string, contour: ContourType): number[] {
    if (!amt || !start || !end || !allMonths.length) return allMonths.map(() => 0);
    const sDate = new Date(start), eDate = new Date(end);
    const segIdx: number[] = [];
    allMonths.forEach((m, i) => {
      const mEnd = new Date(m.getFullYear(), m.getMonth()+1, 1);
      if (m <= eDate && mEnd > sDate) segIdx.push(i);
    });
    if (!segIdx.length) return allMonths.map(() => 0);
    const mults = getContourMultipliers(segIdx.length, contour);
    const mSum = mults.reduce((a, b) => a + b, 0) || 1;
    const result = allMonths.map(() => 0);
    segIdx.forEach((idx, i) => { result[idx] = (mults[i] / mSum) * amt; });
    return result;
  }

  // ── Drag ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!firstMonth) return;
    const fMs = firstMonth.getTime();
    const msPerPx = (allMonths.length * 30.44 * 24 * 3600 * 1000) / (totalGanttW || 1);
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current; if (!d) return;
      const dx = e.clientX - d.startMouseX;
      if (!d.started && Math.abs(dx) < 4) return;
      d.started = true;
      const deltaMs = Math.round(dx * msPerPx / 86_400_000) * 86_400_000;
      let ns = d.origStartMs, ne = d.origEndMs;
      if (d.mode === 'move') { ns += deltaMs; ne += deltaMs; }
      else if (d.mode === 'resize-left') ns = Math.min(d.origStartMs + deltaMs, d.origEndMs - 86_400_000);
      else ne = Math.max(d.origEndMs + deltaMs, d.origStartMs + 86_400_000);
      setDragPreview({ key: d.key, startMs: ns, endMs: ne });
      document.body.style.cursor = d.mode === 'move' ? 'grabbing' : d.mode === 'resize-left' ? 'w-resize' : 'e-resize';
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d?.started && dragPreviewRef.current) {
        const p = dragPreviewRef.current;
        commitFnRef.current(d.key, msToIso(p.startMs), msToIso(p.endMs));
      }
      dragRef.current = null; setDragPreview(null);
      document.body.style.cursor = ''; document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [allMonths, firstMonth, totalGanttW]);

  const startDrag = (e: React.MouseEvent, row: RowState, mode: DragInfo['mode']) => {
    e.preventDefault();
    const s = parseMs(row.start), en = parseMs(row.end);
    if (!s || !en) return;
    dragRef.current = { key: row.key, mode, startMouseX: e.clientX, origStartMs: s, origEndMs: en, started: false };
    document.body.style.userSelect = 'none';
  };

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartLabels = allMonths.map(m =>
    m.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  );

  // Actual labor rate per segment from estimate
  const getSegmentRate = useCallback((key: string): number => {
    const e = estimate as any;
    if (!e) return 0;
    const f = (field: string) => parseFloat(String(e[field])) || 0;
    if (key === '30' || key === '35') return f('sm_labor_rate');
    if (key === '40' || key === '45') return f('pf_labor_rate');
    if (key === '50' || key === '55') return f('pl_labor_rate');
    return 0; // Overhead (70) excluded from chart
  }, [estimate]);

  const getSegmentHours = useCallback((key: string): number => {
    const cost = getCostAmt(key);
    const rate = getSegmentRate(key);
    if (!cost || !rate) return 0;
    return cost / rate;
  }, [getCostAmt, getSegmentRate]);

  const laborDatasets = useMemo(() => {
    return SEGMENT_DEFS.filter(d => d.isLabor && d.key !== '70').map(def => {
      const row   = rows.find(r => r.key === def.key);
      const amt   = getCostAmt(def.key);
      const shift = getShift(def.key);
      const cap   = hrsPerPersonPerMonth(shift);
      const rate  = getSegmentRate(def.key);
      if (!amt || !cap || !rate || !row?.start || !row?.end) return null;
      const monthly = distributeMonthly(amt, row.start, row.end, row.contour);
      const data = monthly.map(v => Math.round((v / rate / cap) * 10) / 10);
      if (!data.some(v => v > 0)) return null;
      return { label: def.label, data, color: def.color };
    }).filter(Boolean) as { label: string; data: number[]; color: string }[];
  }, [rows, getCostAmt, getSegmentRate, shifts, allMonths]);

  const monthlyRevenue = useMemo(() => {
    if (!allMonths.length) return [];
    const marginPct = parseFloat(String((estimate as any)?.margin_pct)) || 0;
    const revMultiplier = marginPct < 1 ? 1 / (1 - marginPct) : 1;
    const monthly = allMonths.map(() => 0);
    rows.forEach(row => {
      const amt = getCostAmt(row.key);
      if (!amt || !row.start || !row.end) return;
      const dist = distributeMonthly(amt, row.start, row.end, row.contour);
      dist.forEach((v, i) => { monthly[i] += v * revMultiplier; });
    });
    return monthly;
  }, [rows, getCostAmt, estimate, allMonths]);

  const hasCharts = allMonths.length > 0 && (laborDatasets.length > 0 || monthlyRevenue.some(v => v > 0));
  const hasAnyDates = rows.some(r => r.start || r.end);

  const chartScales = {
    x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 as const }, maxRotation: 45 as const, color: '#64748b' } },
  };

  if (!rows.length) return <div className="octs-loading">Loading schedule…</div>;

  // Build table rows (group headers interleaved)
  type TRow = { type: 'group'; label: string } | { type: 'data'; row: RowState };
  const tableRows: TRow[] = [];
  let lastGroup = '';
  rows.forEach(row => {
    const g = row.isLabor ? 'LABOR' : 'NON-LABOR';
    if (g !== lastGroup) { tableRows.push({ type: 'group', label: g }); lastGroup = g; }
    tableRows.push({ type: 'data', row });
  });

  // Common cell/header styles (matching CostTypeSchedule inline style pattern)
  const hdrSt = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    padding: '0 0.4rem', fontSize: '0.65rem', fontWeight: 700, color: '#475569',
    textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
    borderBottom: '2px solid #e2e8f0', background: '#f8fafc', userSelect: 'none', ...extra,
  });

  return (
    <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '0.9rem' }}>
          {[
            { label: 'Est',   value: fmtCompact(totalEst),       color: '#1e293b' },
            { label: 'Types', value: `${typesWithDates} / ${rows.length}`, color: '#64748b' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase' }}>{s.label}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={fillMissing}
            style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', fontFamily: 'inherit', border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#1e293b' }}>
            {hasAnyDates ? 'Fill Missing from Project Dates' : 'Initialize from Project Dates'}
          </button>
        </div>
      </div>

      {/* ── Charts + Shift ─────────────────────────────────────────────────── */}
      {hasCharts && (
        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start', flexShrink: 0 }}>

          {/* Shift Schedule */}
          <div style={{ flexShrink: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 0.75rem', background: '#eef2f7', borderBottom: '1px solid #e2e8f0', fontSize: '0.68rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Shift Schedule
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0.25rem 0.75rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <span style={{ flex: 1, fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 120 }}>Trade</span>
              {DAY_LABELS.map((lbl, i) => (
                <span key={i} style={{ width: 32, textAlign: 'center', fontSize: '0.6rem', fontWeight: 700, color: i >= 5 ? '#f59e0b' : '#64748b', flexShrink: 0 }}>{lbl}</span>
              ))}
              <span style={{ width: 40, textAlign: 'right', fontSize: '0.6rem', color: '#94a3b8', flexShrink: 0 }}>Wk</span>
            </div>
            {SEGMENT_DEFS.filter(d => d.isLabor).map((def, ri) => {
              const sh = getShift(def.key);
              const total = weeklyHrs(sh);
              return (
                <div key={def.key} style={{ display: 'flex', alignItems: 'center', padding: '0.28rem 0.75rem', borderBottom: '1px solid #f1f5f9', background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 120 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: def.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.7rem', color: '#374151', whiteSpace: 'nowrap' }}>{def.label}</span>
                  </div>
                  {DAY_KEYS.map((day, di) => (
                    <input key={day} type="number" min={0} max={16} step={0.5} value={sh[day]}
                      onChange={e => updateShift(def.key, day, Math.max(0, Math.min(16, Number(e.target.value))))}
                      style={{ width: 32, padding: '0.15rem 0', border: '1px solid #e2e8f0', borderRadius: 3, fontSize: '0.7rem', textAlign: 'center', fontFamily: 'inherit', flexShrink: 0, background: di >= 5 ? '#fffbeb' : '#fff', color: sh[day] === 0 ? '#cbd5e1' : '#1e293b' }}
                    />
                  ))}
                  <span style={{ width: 40, textAlign: 'right', fontSize: '0.7rem', fontWeight: 600, color: '#3b82f6', flexShrink: 0 }}>{total}h</span>
                </div>
              );
            })}
          </div>

          {/* Labor Resources */}
          {laborDatasets.length > 0 && (
            <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.875rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Labor Resources by Month
              </div>
              <div style={{ height: 200, position: 'relative' }}>
                <Line
                  data={{
                    labels: chartLabels,
                    datasets: laborDatasets.map(ds => ({
                      label: ds.label, data: ds.data,
                      borderColor: ds.color, backgroundColor: ds.color + '18',
                      tension: 0.4, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2, fill: false,
                    })),
                  }}
                  options={{
                    maintainAspectRatio: false, responsive: true,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                      legend: { display: laborDatasets.length > 1, position: 'top', labels: { boxWidth: 12, boxHeight: 2, font: { size: 10 }, padding: 8, usePointStyle: true, pointStyleWidth: 12 } },
                      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(1)} workers` } },
                    },
                    scales: { ...chartScales, y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 9 }, color: '#64748b', callback: v => `${v}` } } },
                  }}
                />
              </div>
            </div>
          )}

          {/* Revenue by Month */}
          {monthlyRevenue.some(v => v > 0) && (
            <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.875rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Revenue by Month
              </div>
              <div style={{ height: 200, position: 'relative' }}>
                <Bar
                  data={{
                    labels: chartLabels,
                    datasets: [{ label: 'Revenue', data: monthlyRevenue, backgroundColor: '#10b981' + '70', borderColor: '#10b981', borderWidth: 1, borderRadius: 2 }],
                  }}
                  options={{
                    maintainAspectRatio: false, responsive: true,
                    plugins: {
                      legend: { display: false },
                      tooltip: { callbacks: { label: ctx => `Revenue: ${fmtCompact(ctx.parsed.y ?? 0)}` } },
                    },
                    scales: { ...chartScales, y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 9 }, color: '#64748b', callback: v => fmtCompact(v as number) } } },
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Gantt Table ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', border: '1px solid #94a3b8', borderRadius: 6, overflow: 'hidden' }}>
        {/* Left sticky panel */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', height: 28, background: '#f8fafc', borderBottom: '2px solid #e2e8f0', flexShrink: 0 }}>
            {[
              { label: 'Cost Type', w: 180, extra: { textAlign: 'left' as const, paddingLeft: '0.5rem' } },
              { label: 'Hrs',       w: 60,  extra: { textAlign: 'right' as const } },
              { label: 'Est $',     w: 74,  extra: { textAlign: 'right' as const } },
              { label: 'Start',     w: 100, extra: {} },
              { label: 'End',       w: 100, extra: {} },
              { label: 'Dur',       w: 50,  extra: { textAlign: 'center' as const } },
              { label: 'Contour',   w: 110, extra: {} },
            ].map(col => (
              <div key={col.label} style={{ ...hdrSt({ ...col.extra }), width: col.w, flexShrink: 0, display: 'flex', alignItems: 'center', borderRight: '1px solid #e2e8f0' }}>
                {col.label}
              </div>
            ))}
          </div>
          {/* Rows */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {tableRows.map((tr, i) => {
              if (tr.type === 'group') {
                return (
                  <div key={`g-${i}`} style={{ display: 'flex', height: 22, alignItems: 'center', background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', paddingLeft: '0.5rem', borderLeft: `3px solid ${tr.label === 'LABOR' ? '#3b82f6' : '#10b981'}` }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{tr.label}</span>
                  </div>
                );
              }
              const row = tr.row;
              const isDragging = dragPreview?.key === row.key;
              const dispStart = isDragging ? msToIso(dragPreview!.startMs) : row.start;
              const dispEnd   = isDragging ? msToIso(dragPreview!.endMs)   : row.end;
              const cellSt: React.CSSProperties = {
                display: 'flex', alignItems: 'center', height: '100%',
                borderRight: '1px solid #e2e8f0', overflow: 'hidden',
                fontSize: '0.7rem', color: '#1e293b', flexShrink: 0,
              };
              const inputSt: React.CSSProperties = {
                width: '100%', padding: '0 0.25rem', border: 'none', fontSize: '0.7rem',
                fontFamily: 'inherit', color: '#1e293b', background: 'transparent', outline: 'none',
                height: '100%', boxSizing: 'border-box', cursor: 'pointer',
              };
              return (
                <div key={row.key} style={{ display: 'flex', height: 28, borderBottom: '1px solid #e2e8f0', borderLeft: `3px solid ${row.isLabor ? '#3b82f6' : '#10b981'}` }}>
                  {/* Label */}
                  <div style={{ ...cellSt, width: 180, gap: 6, padding: '0 0.4rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: row.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{row.label}</span>
                  </div>
                  {/* Hrs */}
                  <div style={{ ...cellSt, width: 60, justifyContent: 'flex-end', padding: '0 0.4rem', color: '#64748b' }}>
                    {row.isLabor ? fmtHrs(getSegmentHours(row.key)) : ''}
                  </div>
                  {/* Est $ */}
                  <div style={{ ...cellSt, width: 74, justifyContent: 'flex-end', padding: '0 0.4rem', color: '#374151' }}>
                    {fmtCompact(getCostAmt(row.key))}
                  </div>
                  {/* Start */}
                  <div style={{ ...cellSt, width: 100, padding: '0 2px' }}>
                    <input type="date" value={dispStart} style={{ ...inputSt, color: dispStart ? '#1e293b' : '#94a3b8' }}
                      onChange={e => updateRow(row.key, { start: e.target.value })} />
                  </div>
                  {/* End */}
                  <div style={{ ...cellSt, width: 100, padding: '0 2px' }}>
                    <input type="date" value={dispEnd} style={{ ...inputSt, color: dispEnd ? '#1e293b' : '#94a3b8' }}
                      onChange={e => updateRow(row.key, { end: e.target.value })} />
                  </div>
                  {/* Dur */}
                  <div style={{ ...cellSt, width: 50, justifyContent: 'center' }}>
                    <DurInput start={dispStart} end={dispEnd} onChange={end => updateRow(row.key, { end })} />
                  </div>
                  {/* Contour */}
                  <div style={{ ...cellSt, width: 110, padding: '0 0.2rem' }}>
                    <ContourVisual contour={row.contour} />
                    <select value={row.contour} onChange={e => updateRow(row.key, { contour: e.target.value as ContourType })}
                      style={{ ...inputSt, flex: 1, cursor: 'pointer' }}>
                      {contourOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Gantt bars area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Month headers */}
          <div style={{ display: 'flex', height: 28, borderBottom: '2px solid #e2e8f0', flexShrink: 0, overflowX: 'hidden' }}>
            {allMonths.map((m, i) => (
              <div key={i} style={{ width: COL_W, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#64748b', fontWeight: 600, background: i % 2 === 0 ? '#f8fafc' : '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>
                {MONTH_NAMES[m.getMonth()]} {String(m.getFullYear()).slice(2)}
              </div>
            ))}
            {allMonths.length === 0 && <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#cbd5e1', fontStyle: 'italic' }}>Set dates to see Gantt</div>}
          </div>
          {/* Bar rows */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            {tableRows.map((tr, i) => {
              if (tr.type === 'group') {
                return <div key={`g-${i}`} style={{ height: 22, background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', minWidth: totalGanttW || '100%' }} />;
              }
              const row = tr.row;
              const isDragging = dragPreview?.key === row.key;
              const dispStart = isDragging ? msToIso(dragPreview!.startMs) : row.start;
              const dispEnd   = isDragging ? msToIso(dragPreview!.endMs)   : row.end;
              const bar = firstMonth && dispStart && dispEnd ? (() => {
                const sMs = isDragging ? dragPreview!.startMs : parseMs(dispStart);
                const eMs = isDragging ? dragPreview!.endMs   : parseMs(dispEnd);
                if (!sMs || !eMs || eMs <= sMs) return null;
                const fMs = firstMonth.getTime();
                const msPerPx = (allMonths.length * 30.44 * 24 * 3600 * 1000) / (totalGanttW || 1);
                const left  = Math.max(0, (sMs - fMs) / msPerPx);
                const width = Math.max(3, (eMs - sMs) / msPerPx);
                return { left, width };
              })() : null;

              return (
                <div key={row.key} style={{ height: 28, borderBottom: '1px solid #e2e8f0', position: 'relative', minWidth: totalGanttW || '100%', background: isDragging ? '#f0f9ff' : 'transparent',
                  backgroundImage: allMonths.length > 0 ? `repeating-linear-gradient(90deg, transparent 0px, transparent ${COL_W}px, rgba(0,0,0,0.025) ${COL_W}px, rgba(0,0,0,0.025) ${COL_W*2}px)` : 'none',
                  backgroundSize: `${COL_W*2}px 100%`,
                }}>
                  {bar && (
                    <div
                      style={{ position: 'absolute', top: 4, height: 20, left: bar.left, width: bar.width, background: row.color, borderRadius: 3, display: 'flex', alignItems: 'center', cursor: 'grab', opacity: isDragging ? 0.75 : 0.88, overflow: 'visible', userSelect: 'none' }}
                      onMouseDown={e => startDrag(e, row, 'move')}
                    >
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'w-resize', background: 'rgba(255,255,255,0.2)', borderRadius: '3px 0 0 3px' }}
                        onMouseDown={e => { e.stopPropagation(); startDrag(e, row, 'resize-left'); }} />
                      <span style={{ flex: 1, fontSize: '0.68rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 8px', pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                        {row.label}
                      </span>
                      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'e-resize', background: 'rgba(255,255,255,0.2)', borderRadius: '0 3px 3px 0' }}
                        onMouseDown={e => { e.stopPropagation(); startDrag(e, row, 'resize-right'); }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpportunitySchedule;
