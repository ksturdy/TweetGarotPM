import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addWeeks, parseISO } from 'date-fns';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  getWeeklyProduction, upsertWeeklyEntry, triggerSnapshot,
  WeeklyProductionItem, WeeklyEntry, HourSnapshot,
} from '../../services/weeklyProduction';
import { phaseScheduleApi } from '../../services/phaseSchedule';
import { getContourMultipliers, ContourType, contourOptions } from '../../utils/contours';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// ── CT constants ──────────────────────────────────────────────────────────────

const CT_BADGE_COLOR: Record<number, string> = {
  1: '#3b82f6', 2: '#10b981', 3: '#f59e0b', 4: '#8b5cf6', 5: '#ef4444', 6: '#64748b',
};
const CT_BADGE_LABEL: Record<number, string> = {
  1: 'L', 2: 'M', 3: 'S', 4: 'R', 5: 'E', 6: 'G',
};
const CT_NAMES: Record<number, string> = {
  1: 'Labor', 2: 'Material', 3: 'Subcontracts', 4: 'Rentals', 5: 'MEP Equipment', 6: 'General Conditions',
};

// ── CT filter dropdown (mirrors the Phase Schedule CTFilterDropdown) ───────────

const CTFilterDropdown: React.FC<{
  selected: Set<number>;
  onToggle: (ct: number) => void;
  onClear: () => void;
}> = ({ selected, onToggle, onClear }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 2, left: r.left + r.width / 2 });
    };
    updatePos();
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

  const active = selected.size > 0;
  const label = active
    ? [...selected].sort().map(ct => CT_NAMES[ct]?.charAt(0)).join('')
    : 'CT ▾';

  return (
    <div ref={triggerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div onClick={() => setOpen(p => !p)} style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700,
        color: active ? '#3b82f6' : 'inherit', userSelect: 'none',
      }}>
        {label}
      </div>
      {open && menuPos && createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: menuPos.top, left: menuPos.left, transform: 'translateX(-50%)',
          zIndex: 9999, background: 'white', border: '1px solid #e2e8f0', borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: 160, padding: '4px 0', fontSize: '0.75rem', whiteSpace: 'nowrap',
        }}>
          {active && (
            <>
              <div onClick={() => { onClear(); setOpen(false); }}
                style={{ padding: '4px 10px', cursor: 'pointer', color: '#ef4444', fontSize: '0.7rem' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
                Clear filter
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', margin: '2px 0' }} />
            </>
          )}
          {[1, 2, 3, 4, 5, 6].map(ct => (
            <label key={ct} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}>
              <input type="checkbox" checked={selected.has(ct)} onChange={() => onToggle(ct)} style={{ cursor: 'pointer' }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: CT_BADGE_COLOR[ct], flexShrink: 0 }} />
              <span style={{ color: '#1e293b' }}>{CT_NAMES[ct]}</span>
            </label>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

// ── helpers ───────────────────────────────────────────────────────────────────

function toSunday(d: Date): Date {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}
function ymd(d: Date): string { return format(d, 'yyyy-MM-dd'); }
function parseNum(v: unknown): number { const n = Number(v); return isFinite(n) ? n : 0; }
function fmt1(n: number): string { return n === 0 ? '—' : n % 1 === 0 ? n.toLocaleString() : n.toFixed(1); }
function fmtCost(n: number): string { return n === 0 ? '—' : '$' + Math.round(n).toLocaleString(); }

function buildWeeks(from: string, to: string): string[] {
  const weeks: string[] = [];
  let cur = toSunday(parseISO(from));
  const end = toSunday(parseISO(to));
  while (cur <= end) { weeks.push(ymd(cur)); cur = addWeeks(cur, 1); }
  return weeks;
}

/** Distribute a total value across weekly buckets using the item's contour. */
function distributeWeekly(
  total: number,
  startDate: string,
  endDate: string,
  contourType: string,
  allWeeks: string[],
): Record<string, number> {
  if (!startDate || !endDate || total <= 0) return {};
  const itemStart = ymd(toSunday(parseISO(startDate)));
  const itemEnd   = ymd(toSunday(parseISO(endDate)));
  const span = allWeeks.filter(w => w >= itemStart && w <= itemEnd);
  if (!span.length) return {};
  const multipliers = getContourMultipliers(span.length, (contourType || 'flat') as ContourType);
  const result: Record<string, number> = {};
  span.forEach((w, i) => { result[w] = (total / span.length) * multipliers[i]; });
  return result;
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  projectId: number | string;
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  /** Pre-filtered labor items passed in from the parent PhaseSchedule view */
  externalItems?: WeeklyProductionItem[];
}

const TODAY = ymd(new Date());

export default function WeeklyProductionGrid({ projectId, projectStartDate, projectEndDate, externalItems }: Props) {
  const qc = useQueryClient();
  const { toast } = useTitanFeedback();
  const gridScrollRef = useRef<HTMLDivElement>(null);

  const defaultFrom = projectStartDate
    ? ymd(toSunday(parseISO(projectStartDate)))
    : ymd(toSunday(addWeeks(new Date(), -12)));
  const defaultTo = projectEndDate
    ? ymd(toSunday(parseISO(projectEndDate)))
    : ymd(toSunday(addWeeks(new Date(), 52)));

  const [from, setFrom]           = useState(defaultFrom);
  const [to, setTo]               = useState(defaultTo);
  const [snapshotting, setSnapshotting] = useState(false);
  const [hideNoQty, setHideNoQty] = useState(false);
  const [metric, setMetric]       = useState<'qty' | 'hours' | 'cost'>('qty');
  const [filterText, setFilterText] = useState('');
  const [sortDir, setSortDir]       = useState<'none' | 'asc' | 'desc'>('none');
  const [ctFilter, setCtFilter]     = useState<Set<number>>(new Set());

  // Optimistic overrides for item-level fields
  type ItemEdits = { quantity?: number | null; total_est_hours?: number; start_date?: string | null; end_date?: string | null; contour_type?: string; use_manual_qty_values?: boolean };
  const [localItemEdits, setLocalItemEdits] = useState<Record<number, ItemEdits>>({});

  const handleItemFieldSave = useCallback(async (
    item: WeeklyProductionItem,
    field: keyof ItemEdits,
    rawValue: string | number | boolean,
  ) => {
    let value: any = rawValue;
    if (field === 'quantity' || field === 'total_est_hours') {
      const n = parseFloat(String(rawValue));
      value = isNaN(n) || n < 0 ? 0 : n;
    }
    if (value === (item as any)[field]) return;
    setLocalItemEdits(p => ({ ...p, [item.id]: { ...p[item.id], [field]: value } }));
    try {
      await phaseScheduleApi.updateItem(item.id, { [field]: value } as any);
      qc.invalidateQueries({ queryKey: ['weeklyProduction', projectId] });
      qc.invalidateQueries({ queryKey: ['phaseScheduleItems', String(projectId)] });
    } catch {
      toast.error('Failed to save');
      setLocalItemEdits(p => { const n = { ...p }; if (n[item.id]) delete (n[item.id] as any)[field]; return n; });
    }
  }, [projectId, qc, toast]);

  // Optimistic overrides for manual scheduled qty values: key = itemId
  const [localManualQty, setLocalManualQty] = useState<Record<number, Record<string, number>>>({});

  const handleManualQtyEdit = useCallback(async (item: WeeklyProductionItem, week: string, rawValue: string) => {
    const val = parseFloat(rawValue);
    const newVal = isNaN(val) || val < 0 ? 0 : val;
    const baseManual = item.manual_monthly_qty ?? {};
    const prevLocal  = localManualQty[item.id] ?? {};
    const newManual  = { ...baseManual, ...prevLocal, [week]: newVal };
    setLocalManualQty(p => ({ ...p, [item.id]: newManual }));
    try {
      await phaseScheduleApi.updateItem(item.id, { manual_monthly_qty: newManual } as any);
      qc.invalidateQueries({ queryKey: ['weeklyProduction', projectId] });
    } catch {
      toast.error('Failed to save schedule qty');
      setLocalManualQty(p => { const n = { ...p }; delete n[item.id]; return n; });
    }
  }, [localManualQty, projectId, qc, toast]);

  // Optimistic local qty overrides: key = `${itemId}-${weekEnding}`
  const [localQty, setLocalQty] = useState<Record<string, number>>({});
  const savingRef = useRef<Set<string>>(new Set());

  // Resizable frozen column widths (px)
  const [colWidths, setColWidths] = useState({
    label: 54, name: 220, ct: 32, estQty: 58, uom: 40, hrs: 64,
    start: 76, finish: 76, contour: 60, remQty: 56, unalloc: 50,
  });
  const resizingRef = useRef<{ col: keyof typeof colWidths; startX: number; startW: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['weeklyProduction', projectId, from, to],
    queryFn: () => getWeeklyProduction(projectId, from, to),
  });

  const weeks = useMemo(() => buildWeeks(from, to), [from, to]);

  // Scroll to current week once after the table has rendered
  const didAutoScroll = useRef(false);
  useEffect(() => {
    if (isLoading || didAutoScroll.current || !gridScrollRef.current || weeks.length === 0) return;
    didAutoScroll.current = true;
    const todaySunday = ymd(toSunday(new Date()));
    const idx = weeks.findIndex(w => w >= todaySunday);
    // Start scroll one week before current so current week is visually the second column,
    // making it easy to see last week's entry alongside this week
    const scrollToIdx = Math.max(0, idx - 1);
    if (scrollToIdx > 0) {
      gridScrollRef.current.scrollLeft = scrollToIdx * 72; // 72 = WEEK_W
    }
  }, [isLoading, weeks]);

  // Global mouse handlers for column resize drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = e.clientX - resizingRef.current.startX;
      const newW  = Math.max(40, resizingRef.current.startW + delta);
      setColWidths(prev => ({ ...prev, [resizingRef.current!.col]: newW }));
    };
    const onUp = () => { resizingRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Always use the weekly-production API data as the base so the internal
  // filter correctly updates the chart and footer totals. The backend already
  // returns labor-only items (cost_types includes 1).
  const items = useMemo(() => {
    let base = data?.items ?? [];
    if (hideNoQty) base = base.filter(item => parseNum(item.quantity) > 0);
    if (ctFilter.size > 0) {
      base = base.filter(item => item.cost_types?.some(ct => ctFilter.has(ct)));
    }
    if (filterText.trim()) {
      const raw = filterText.trim().toLowerCase();
      if (raw.includes('*')) {
        const escaped = raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        const regex = new RegExp('^' + escaped + '$', 'i');
        base = base.filter(i => regex.test(i.name) || (i.phase_code_display != null && regex.test(i.phase_code_display)));
      } else {
        base = base.filter(i =>
          i.name.toLowerCase().startsWith(raw) ||
          (i.phase_code_display != null && i.phase_code_display.toLowerCase().startsWith(raw))
        );
      }
    }
    if (sortDir !== 'none') {
      base = [...base].sort((a, b) => {
        const cmp = a.name.localeCompare(b.name);
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return base;
  }, [data, hideNoQty, ctFilter, filterText, sortDir]);

  // ── derived data ─────────────────────────────────────────────────────────

  const entryMap = useMemo(() => {
    const m: Record<string, number> = {};
    (data?.entries ?? []).forEach((e: WeeklyEntry) => {
      m[`${e.phase_schedule_item_id}-${e.week_ending}`] = parseNum(e.qty_installed);
    });
    return m;
  }, [data]);

  const snapshotMap = useMemo(() => {
    const m: Record<string, number> = {};
    (data?.snapshots ?? []).forEach((s: HourSnapshot) => {
      m[`${s.phase_schedule_item_id}-${s.week_ending}`] = parseNum(s.jtd_hours);
    });
    return m;
  }, [data]);

  const getActualQty = useCallback((itemId: number, week: string): number | null => {
    const key = `${itemId}-${week}`;
    if (key in localQty) return localQty[key];
    return key in entryMap ? entryMap[key] : null;
  }, [localQty, entryMap]);

  const getBurnedHours = useCallback((itemId: number, week: string): number => {
    const cur = snapshotMap[`${itemId}-${week}`] ?? null;
    if (cur === null) return 0;
    const idx = weeks.indexOf(week);
    if (idx <= 0) return cur;
    const prior = snapshotMap[`${itemId}-${weeks[idx - 1]}`] ?? null;
    return prior === null ? cur : Math.max(0, cur - prior);
  }, [snapshotMap, weeks]);

  // Pre-compute scheduled qty per item per week (manual or contour)
  const scheduledQtyByItem = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    items.forEach(item => {
      const edits      = localItemEdits[item.id] ?? {};
      const isManual   = edits.use_manual_qty_values !== undefined ? edits.use_manual_qty_values : item.use_manual_qty_values;
      const effStart   = (edits.start_date   !== undefined ? edits.start_date   : item.start_date)   ?? '';
      const effEnd     = (edits.end_date     !== undefined ? edits.end_date     : item.end_date)     ?? '';
      const effContour = (edits.contour_type !== undefined ? edits.contour_type : item.contour_type) ?? 'flat';
      const effQty     = parseNum(edits.quantity !== undefined ? edits.quantity : item.quantity);
      if (isManual) {
        const base = item.manual_monthly_qty ?? {};
        const overrides = localManualQty[item.id] ?? {};
        const merged = { ...base, ...overrides };
        const m: Record<string, number> = {};
        weeks.forEach(w => { m[w] = merged[w] ?? 0; });
        map[item.id] = m;
      } else {
        map[item.id] = distributeWeekly(effQty, effStart, effEnd, effContour, weeks);
      }
    });
    return map;
  }, [items, weeks, localItemEdits, localManualQty]);

  // Pre-compute scheduled hours per item per week
  const scheduledHrsByItem = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    items.forEach(item => {
      const edits      = localItemEdits[item.id] ?? {};
      const effStart   = (edits.start_date   !== undefined ? edits.start_date   : item.start_date)   ?? '';
      const effEnd     = (edits.end_date     !== undefined ? edits.end_date     : item.end_date)     ?? '';
      const effContour = (edits.contour_type !== undefined ? edits.contour_type : item.contour_type) ?? 'flat';
      const effHrs     = parseNum(edits.total_est_hours !== undefined ? edits.total_est_hours : item.total_est_hours);
      map[item.id] = distributeWeekly(effHrs, effStart, effEnd, effContour, weeks);
    });
    return map;
  }, [items, weeks, localItemEdits]);

  // Pre-compute scheduled cost per item per week
  const scheduledCostByItem = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    items.forEach(item => {
      const edits      = localItemEdits[item.id] ?? {};
      const effStart   = (edits.start_date   !== undefined ? edits.start_date   : item.start_date)   ?? '';
      const effEnd     = (edits.end_date     !== undefined ? edits.end_date     : item.end_date)     ?? '';
      const effContour = (edits.contour_type !== undefined ? edits.contour_type : item.contour_type) ?? 'flat';
      map[item.id] = distributeWeekly(parseNum(item.total_est_cost), effStart, effEnd, effContour, weeks);
    });
    return map;
  }, [items, weeks, localItemEdits]);

  // Pre-compute reforecast: spread Rem Qty flat across future weeks within the item's finish date.
  // This answers "what rate do we need each week to still finish on time?"
  const reforecastWeeklyByItem = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    items.forEach(item => {
      const edits  = localItemEdits[item.id] ?? {};
      const effEnd = (edits.end_date  !== undefined ? edits.end_date  : item.end_date)  ?? '';
      const effQty = parseNum(edits.quantity !== undefined ? edits.quantity : item.quantity);
      const remQty = effQty > 0 ? Math.max(0, effQty - parseNum(item.quantity_installed)) : 0;
      if (remQty <= 0 || !effEnd) { map[item.id] = {}; return; }
      const effStart2 = (localItemEdits[item.id]?.start_date !== undefined ? localItemEdits[item.id].start_date : item.start_date) ?? '';
      const itemStart = effStart2 ? ymd(toSunday(parseISO(effStart2))) : TODAY;
      const itemEnd   = ymd(toSunday(parseISO(effEnd)));
      // Only spread across weeks within the item's own scheduled window that are still in the future
      const futureWeeks = weeks.filter(w => w > TODAY && w >= itemStart && w <= itemEnd);
      if (!futureWeeks.length) { map[item.id] = {}; return; }
      const perWeek = remQty / futureWeeks.length;
      const result: Record<string, number> = {};
      futureWeeks.forEach(w => { result[w] = perWeek; });
      map[item.id] = result;
    });
    return map;
  }, [items, weeks, localItemEdits]);

  const snapshotCostMap = useMemo(() => {
    const m: Record<string, number> = {};
    (data?.snapshots ?? []).forEach((s: HourSnapshot) => {
      m[`${s.phase_schedule_item_id}-${s.week_ending}`] = parseNum(s.jtd_cost);
    });
    return m;
  }, [data]);

  const getBurnedCost = useCallback((itemId: number, week: string): number => {
    const cur = snapshotCostMap[`${itemId}-${week}`] ?? null;
    if (cur === null) return 0;
    const idx = weeks.indexOf(week);
    if (idx <= 0) return cur;
    const prior = snapshotCostMap[`${itemId}-${weeks[idx - 1]}`] ?? null;
    return prior === null ? cur : Math.max(0, cur - prior);
  }, [snapshotCostMap, weeks]);

  // ── chart data (metric-driven) ────────────────────────────────────────────

  const chartData = useMemo(() => {
    const schedByWeek: Record<string, number> = {};
    const earnedByWeek: Record<string, number> = {};
    const burnedByWeek: Record<string, number> = {};

    items.forEach(item => {
      const qty    = parseNum(item.quantity);
      const estHrs = parseNum(item.total_est_hours);
      const estCost = parseNum(item.total_est_cost);
      const hrsRate  = qty > 0 && estHrs  > 0 ? estHrs  / qty : 0;
      const costRate = qty > 0 && estCost > 0 ? estCost / qty : 0;
      weeks.forEach(w => {
        const actual = getActualQty(item.id, w) ?? 0;
        if (metric === 'qty') {
          schedByWeek[w]  = (schedByWeek[w]  || 0) + (scheduledQtyByItem[item.id]?.[w]  || 0);
          earnedByWeek[w] = (earnedByWeek[w] || 0) + actual;
        } else if (metric === 'hours') {
          // Only items with a measurable quantity contribute to Sched/Earned Hours —
          // indirect items (qty=0) can never earn, so including their scheduled hours
          // creates a permanent gap that doesn't reflect actual productivity.
          if (qty > 0) {
            schedByWeek[w]  = (schedByWeek[w]  || 0) + (scheduledHrsByItem[item.id]?.[w]  || 0);
            earnedByWeek[w] = (earnedByWeek[w] || 0) + actual * hrsRate;
          }
          burnedByWeek[w] = (burnedByWeek[w] || 0) + getBurnedHours(item.id, w);
        } else {
          schedByWeek[w]  = (schedByWeek[w]  || 0) + (scheduledCostByItem[item.id]?.[w] || 0);
          earnedByWeek[w] = (earnedByWeek[w] || 0) + actual * costRate;
          burnedByWeek[w] = (burnedByWeek[w] || 0) + getBurnedCost(item.id, w);
        }
      });
    });

    let cumSched = 0, cumEarned = 0, cumBurned = 0;
    const labels: string[]      = [];
    const schedLine: number[]   = [];
    const earnedLine: number[]  = [];
    const burnedLine: number[]  = [];

    weeks.forEach(w => {
      cumSched  += schedByWeek[w]  || 0;
      cumEarned += earnedByWeek[w] || 0;
      cumBurned += burnedByWeek[w] || 0;
      labels.push(format(parseISO(w), 'M/d/yy'));
      schedLine.push(Math.round(cumSched));
      earnedLine.push(Math.round(cumEarned));
      burnedLine.push(Math.round(cumBurned));
    });

    const cfg = {
      qty:   { sched: 'Scheduled Qty',  earned: 'Actual Qty',   burned: null },
      hours: { sched: 'Scheduled Hours', earned: 'Earned Hours', burned: 'Burned Hours' },
      cost:  { sched: 'Scheduled Cost',  earned: 'Earned Cost',  burned: 'Burned Cost'  },
    }[metric];

    const datasets: any[] = [
      { label: cfg.sched,  data: schedLine,  borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', fill: false, tension: 0.3, pointRadius: 2, borderWidth: 2 },
      { label: cfg.earned, data: earnedLine, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)', fill: false, tension: 0.3, pointRadius: 2, borderWidth: 2 },
    ];
    if (cfg.burned) {
      datasets.push({ label: cfg.burned, data: burnedLine, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)', fill: false, tension: 0.3, pointRadius: 2, borderWidth: 2 });
    }
    return { labels, datasets };
  }, [metric, items, weeks, scheduledQtyByItem, scheduledHrsByItem, scheduledCostByItem, getActualQty, getBurnedHours, getBurnedCost]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { position: 'bottom' as const, labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}` } },
    },
    scales: {
      x: { ticks: { font: { size: 10 }, maxRotation: 45 }, grid: { display: false } },
      y: { ticks: { font: { size: 10 } }, title: { display: true, font: { size: 10 },
        text: metric === 'qty' ? 'Cumulative Qty' : metric === 'hours' ? 'Cumulative Hours' : 'Cumulative Cost ($)',
      }},
    },
  }), [metric]);

  // ── cell save ─────────────────────────────────────────────────────────────

  const handleCellBlur = useCallback(async (item: WeeklyProductionItem, week: string, rawValue: string) => {
    const key = `${item.id}-${week}`;
    const qty = parseFloat(rawValue);
    const newQty = isNaN(qty) || qty < 0 ? 0 : qty;
    const prev = entryMap[key] ?? null;
    if (newQty === (prev ?? 0) && !(key in localQty)) return;

    setLocalQty(p => ({ ...p, [key]: newQty }));
    savingRef.current.add(key);
    try {
      await upsertWeeklyEntry(projectId, item.id, week, newQty);
      qc.invalidateQueries({ queryKey: ['weeklyProduction', projectId] });
      qc.invalidateQueries({ queryKey: ['phaseScheduleItems', String(projectId)] });
    } catch {
      toast.error('Failed to save entry');
      setLocalQty(p => { const n = { ...p }; delete n[key]; return n; });
    } finally {
      savingRef.current.delete(key);
    }
  }, [entryMap, localQty, projectId, qc, toast]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      const r = await triggerSnapshot(projectId);
      toast.success(`Snapshot captured — ${r.rows} rows updated`);
      qc.invalidateQueries({ queryKey: ['weeklyProduction', projectId] });
    } catch {
      toast.error('Snapshot failed');
    } finally { setSnapshotting(false); }
  };

  // ── summary totals ────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    const schedQty: Record<string, number>  = {};
    const actualQty: Record<string, number> = {};
    const schedHrs: Record<string, number>  = {};
    const earnedHrs: Record<string, number> = {};
    const burnedHrs: Record<string, number> = {};
    const schedCost: Record<string, number> = {};
    const earnedCost: Record<string, number> = {};
    const burnedCost: Record<string, number> = {};

    items.forEach(item => {
      const qty     = parseNum(item.quantity);
      const estHrs  = parseNum(item.total_est_hours);
      const estCost = parseNum(item.total_est_cost);
      const hrsRate  = qty > 0 && estHrs  > 0 ? estHrs  / qty : 0;
      const costRate = qty > 0 && estCost > 0 ? estCost / qty : 0;
      weeks.forEach(w => {
        const a = getActualQty(item.id, w) ?? 0;
        schedQty[w]   = (schedQty[w]   || 0) + (scheduledQtyByItem[item.id]?.[w]  || 0);
        actualQty[w]  = (actualQty[w]  || 0) + a;
        schedHrs[w]   = (schedHrs[w]   || 0) + (qty > 0 ? (scheduledHrsByItem[item.id]?.[w] || 0) : 0);
        earnedHrs[w]  = (earnedHrs[w]  || 0) + a * hrsRate;
        burnedHrs[w]  = (burnedHrs[w]  || 0) + getBurnedHours(item.id, w);
        schedCost[w]  = (schedCost[w]  || 0) + (scheduledCostByItem[item.id]?.[w] || 0);
        earnedCost[w] = (earnedCost[w] || 0) + a * costRate;
        burnedCost[w] = (burnedCost[w] || 0) + getBurnedCost(item.id, w);
      });
    });
    return { schedQty, actualQty, schedHrs, earnedHrs, burnedHrs, schedCost, earnedCost, burnedCost };
  }, [items, weeks, scheduledQtyByItem, scheduledHrsByItem, scheduledCostByItem, getActualQty, getBurnedHours, getBurnedCost]);

  const handleCtToggle = useCallback((ct: number) => {
    setCtFilter(prev => { const n = new Set(prev); n.has(ct) ? n.delete(ct) : n.add(ct); return n; });
  }, []);
  const handleCtClear = useCallback(() => setCtFilter(new Set()), []);

  // ── layout — derived from resizable colWidths state ──────────────────────
  const WEEK_W    = 72;
  const LABEL_W   = colWidths.label;
  const NAME_W    = colWidths.name;
  const CT_W      = colWidths.ct;
  const ESTQTY_W  = colWidths.estQty;
  const UOM_W     = colWidths.uom;
  const HRS_W     = colWidths.hrs;
  const START_W   = colWidths.start;
  const FINISH_W  = colWidths.finish;
  const CONTOUR_W = colWidths.contour;
  const REMQTY_W  = colWidths.remQty;
  const UNALLOC_W = colWidths.unalloc;
  const L0  = 0;
  const L1  = LABEL_W;
  const L2  = L1 + NAME_W;
  const L3  = L2 + CT_W;
  const L4  = L3 + ESTQTY_W;
  const L5  = L4 + UOM_W;
  const L6  = L5 + HRS_W;
  const L7  = L6 + START_W;
  const L8  = L7 + FINISH_W;
  const L9  = L8 + CONTOUR_W;
  const L10 = L9 + REMQTY_W;
  const FIXED_W = L10 + UNALLOC_W;

  const freezeShadow = '2px 0 0 0 #94a3b8';

  // Resize handle style + starter — shared by all frozen column headers
  const rhStyle: React.CSSProperties = { position: 'absolute', right: -2, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 10 };
  const startResize = (e: React.MouseEvent, col: keyof typeof colWidths, w: number) => {
    e.preventDefault();
    resizingRef.current = { col, startX: e.clientX, startW: w };
  };

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#6b7280' }}>
      Loading…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0 }}>
        <label style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
          From <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 6px' }} />
        </label>
        <label style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
          To <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 6px' }} />
        </label>
        {/* Metric toggle */}
        <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
          {(['qty', 'hours', 'cost'] as const).map((m, i) => (
            <button key={m} onClick={() => setMetric(m)} style={{
              padding: '3px 10px', border: 'none', borderLeft: i === 0 ? 'none' : '1px solid #e2e8f0',
              background: metric === m ? '#7c3aed' : '#fff',
              color: metric === m ? '#fff' : '#374151',
              cursor: 'pointer', fontSize: 11, fontWeight: metric === m ? 600 : 400,
              textTransform: 'capitalize',
            }}>{m === 'qty' ? 'Qty' : m === 'hours' ? 'Hours' : 'Cost'}</button>
          ))}
        </div>
        <label style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={hideNoQty} onChange={e => setHideNoQty(e.target.checked)} style={{ cursor: 'pointer' }} />
          Hide no-qty items
        </label>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={handleSnapshot} disabled={snapshotting} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 4, border: '1px solid #cbd5e1',
            background: '#fff', color: '#374151', cursor: snapshotting ? 'default' : 'pointer',
            opacity: snapshotting ? 0.5 : 1,
          }}>
            {snapshotting ? 'Snapshotting…' : 'Snapshot Now'}
          </button>
        </div>
      </div>

      {/* ── Filter indicator ──────────────────────────────────────────── */}
      {filterText.trim() && (
        <div style={{ padding: '2px 16px', fontSize: 11, color: '#92400e', background: '#fffbeb', borderBottom: '1px solid #fcd34d', flexShrink: 0 }}>
          Filtered: <strong>{filterText.trim()}</strong> — {items.length} item{items.length !== 1 ? 's' : ''} · chart and totals reflect this filter
        </div>
      )}

      {/* ── S-Curve Chart ─────────────────────────────────────────────── */}
      <div style={{ height: 180, padding: '8px 16px 4px', flexShrink: 0, borderBottom: '1px solid #e2e8f0' }}>
        <Line data={chartData} options={chartOptions} />
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────── */}
      <div ref={gridScrollRef} style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 12, tableLayout: 'fixed', width: FIXED_W + weeks.length * WEEK_W }}>
          <colgroup>
            <col style={{ width: LABEL_W }} />
            <col style={{ width: NAME_W }} />
            <col style={{ width: CT_W }} />
            <col style={{ width: ESTQTY_W }} />
            <col style={{ width: UOM_W }} />
            <col style={{ width: HRS_W }} />
            <col style={{ width: START_W }} />
            <col style={{ width: FINISH_W }} />
            <col style={{ width: CONTOUR_W }} />
            <col style={{ width: REMQTY_W }} />
            <col style={{ width: UNALLOC_W }} />
            {weeks.map(w => <col key={w} style={{ width: WEEK_W }} />)}
          </colgroup>

          {/* Sticky header */}
          <thead>
            <tr>
              <th style={{ ...th(LABEL_W),           position: 'sticky', top: 0, left: L0,  zIndex: 41, overflow: 'visible' }}>#<div style={rhStyle} onMouseDown={e => startResize(e, 'label',   LABEL_W)}   /></th>
              <th style={{ ...th(NAME_W, 'left'),    position: 'sticky', top: 0, left: L1,  zIndex: 41, overflow: 'visible' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, width: '100%' }}>
                  <input
                    type="text"
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    placeholder="Filter prefix (* = wildcard)"
                    title="Type a phase prefix or use * as wildcard (e.g. 30*, *labor*)"
                    style={{ flex: 1, padding: '0.15rem 0.3rem', fontSize: '0.65rem', border: '1px solid #e2e8f0', borderRadius: 3, background: filterText ? '#fffbeb' : '#fff', color: '#1e293b', outline: 'none', minWidth: 0, fontWeight: 400 }}
                  />
                  {filterText && (
                    <button onClick={() => setFilterText('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.65rem', color: '#94a3b8', lineHeight: 1, flexShrink: 0 }}>✕</button>
                  )}
                  <button
                    onClick={() => setSortDir(d => d === 'none' ? 'asc' : d === 'asc' ? 'desc' : 'none')}
                    title={sortDir === 'none' ? 'Sort A→Z' : sortDir === 'asc' ? 'Sort Z→A' : 'Clear sort'}
                    style={{ background: sortDir !== 'none' ? '#fffbeb' : '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 3, cursor: 'pointer', padding: '0.1rem 0.3rem', fontSize: '0.65rem', color: '#475569', lineHeight: 1, flexShrink: 0 }}
                  >
                    {sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '↕'}
                  </button>
                </div>
                <div style={rhStyle} onMouseDown={e => startResize(e, 'name', NAME_W)} />
              </th>
              <th style={{ ...th(CT_W),              position: 'sticky', top: 0, left: L2,  zIndex: 41, padding: 0, overflow: 'visible' }}>
                <CTFilterDropdown selected={ctFilter} onToggle={handleCtToggle} onClear={handleCtClear} />
              </th>
              <th style={{ ...th(ESTQTY_W),          position: 'sticky', top: 0, left: L3,  zIndex: 41, overflow: 'visible' }}>Est Qty<div style={rhStyle} onMouseDown={e => startResize(e, 'estQty',  ESTQTY_W)}  /></th>
              <th style={{ ...th(UOM_W),             position: 'sticky', top: 0, left: L4,  zIndex: 41, overflow: 'visible' }}>UOM<div style={rhStyle} onMouseDown={e => startResize(e, 'uom',     UOM_W)}     /></th>
              <th style={{ ...th(HRS_W),             position: 'sticky', top: 0, left: L5,  zIndex: 41, overflow: 'visible' }}>Est Hrs<div style={rhStyle} onMouseDown={e => startResize(e, 'hrs',     HRS_W)}     /></th>
              <th style={{ ...th(START_W),           position: 'sticky', top: 0, left: L6,  zIndex: 41, overflow: 'visible' }}>Start<div style={rhStyle} onMouseDown={e => startResize(e, 'start',   START_W)}   /></th>
              <th style={{ ...th(FINISH_W),          position: 'sticky', top: 0, left: L7,  zIndex: 41, overflow: 'visible' }}>Finish<div style={rhStyle} onMouseDown={e => startResize(e, 'finish',  FINISH_W)}  /></th>
              <th style={{ ...th(CONTOUR_W),         position: 'sticky', top: 0, left: L8,  zIndex: 41, overflow: 'visible' }}>Contour<div style={rhStyle} onMouseDown={e => startResize(e, 'contour', CONTOUR_W)} /></th>
              <th style={{ ...th(REMQTY_W),          position: 'sticky', top: 0, left: L9,  zIndex: 41, overflow: 'visible' }}>Rem Qty<div style={rhStyle} onMouseDown={e => startResize(e, 'remQty',  REMQTY_W)}  /></th>
              <th style={{ ...th(UNALLOC_W),         position: 'sticky', top: 0, left: L10, zIndex: 41, boxShadow: freezeShadow, borderRight: 'none' }}>Unalloc</th>
              {weeks.map(w => (
                <th key={w} style={{ ...th(WEEK_W), position: 'sticky', top: 0, zIndex: 30, background: w === TODAY ? '#dbeafe' : '#eef2f7' }}>
                  {format(parseISO(w), 'M/d')}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={11 + weeks.length} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                No labor phase schedule items found.
              </td></tr>
            )}

            {items.map((item, idx) => {
              // Alternating pair colours — even items get blue tint, odd get green tint
              const schedBg  = idx % 2 === 0 ? '#e8f0fe' : '#ecfdf5';
              const actualBg = idx % 2 === 0 ? '#f0f6ff' : '#f6fef9';
              const edits      = localItemEdits[item.id] ?? {};
              const isManual   = edits.use_manual_qty_values !== undefined ? edits.use_manual_qty_values : item.use_manual_qty_values;
              const effQty     = edits.quantity          !== undefined ? edits.quantity          : item.quantity;
              const effHrs     = edits.total_est_hours   !== undefined ? edits.total_est_hours   : item.total_est_hours;
              const effStart   = edits.start_date        !== undefined ? edits.start_date        : item.start_date;
              const effEnd     = edits.end_date          !== undefined ? edits.end_date          : item.end_date;
              const effContour = edits.contour_type      !== undefined ? edits.contour_type      : item.contour_type;
              const qty        = parseNum(effQty);
              const estHrs     = parseNum(effHrs);
              const estCost    = parseNum(item.total_est_cost);
              const hrsRate    = qty > 0 && estHrs  > 0 ? estHrs  / qty : 0;
              const costRate   = qty > 0 && estCost > 0 ? estCost / qty : 0;
              const remQty     = qty > 0 ? Math.max(0, qty - parseNum(item.quantity_installed)) : null;
              // Unallocated: only meaningful in manual mode
              const allocatedQty  = isManual ? Object.values({ ...(item.manual_monthly_qty ?? {}), ...(localManualQty[item.id] ?? {}) }).reduce((s, v) => s + v, 0) : qty;
              const unallocatedQty = isManual ? qty - allocatedQty : null;
              // Reforecast row: show in all metric modes when there is remaining work and future weeks
              const reqdMap       = remQty !== null && remQty > 0
                ? (reforecastWeeklyByItem[item.id] ?? {}) : {};
              const reqdWeekCount = Object.keys(reqdMap).length;
              const showReqd      = reqdWeekCount > 0;
              const reqdBg        = idx % 2 === 0 ? '#fefce8' : '#fffbeb';

              return (
                <React.Fragment key={item.id}>
                  {/* ── Scheduled row ── */}
                  <tr>
                    <td style={{ ...td(LABEL_W, 'center'), position: 'sticky', left: L0, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', padding: '2px 4px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <span style={{ color: '#475569', fontWeight: 700, fontSize: 11 }}>{item.row_number || idx + 1}</span>
                        <button
                          onClick={() => handleItemFieldSave(item, 'use_manual_qty_values', !isManual)}
                          title={isManual ? 'Manual schedule — click to switch to auto' : 'Auto schedule — click to switch to manual'}
                          style={{ fontSize: 9, padding: '1px 4px', border: '1px solid', borderRadius: 3, cursor: 'pointer', lineHeight: 1.2,
                            background: isManual ? '#7c3aed' : 'transparent',
                            color: isManual ? '#fff' : '#94a3b8',
                            borderColor: isManual ? '#7c3aed' : '#cbd5e1',
                          }}
                        >{isManual ? 'M' : 'A'}</button>
                      </div>
                    </td>
                    <td style={{ ...td(NAME_W, 'left'), position: 'sticky', left: L1, zIndex: 2, background: schedBg,
                                 paddingLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                 borderTop: '2px solid #cbd5e1' }}
                      title={item.phase_code_display ? `${item.phase_code_display} — ${item.name}` : item.name}>
                      {item.phase_code_display && (
                        <span style={{ color: '#64748b', fontSize: 10, marginRight: 5, fontWeight: 400 }}>
                          {item.phase_code_display}
                        </span>
                      )}
                      <span style={{ fontWeight: 600, color: '#1e3a5f' }}>{item.name}</span>
                    </td>
                    <td style={{ ...td(CT_W, 'center'), position: 'sticky', left: L2, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1' }}>
                      {item.cost_types?.map(ct => (
                        <span key={ct} style={{
                          display: 'inline-block', width: 16, height: 16, borderRadius: 3, lineHeight: '16px',
                          textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#fff',
                          backgroundColor: CT_BADGE_COLOR[ct] || '#64748b', marginRight: 1,
                        }}>
                          {CT_BADGE_LABEL[ct] || ct}
                        </span>
                      ))}
                    </td>
                    <td style={{ ...td(ESTQTY_W, 'right'), position: 'sticky', left: L3, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', padding: '1px 3px' }}>
                      <input type="number" min="0" step="any"
                        defaultValue={qty > 0 ? qty : ''}
                        key={`estqty-${item.id}-${qty}`}
                        onBlur={e => handleItemFieldSave(item, 'quantity', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'right', fontSize: 12, color: '#374151', outline: 'none', padding: '0 3px' }}
                      />
                    </td>
                    <td style={{ ...td(UOM_W, 'center'), position: 'sticky', left: L4, zIndex: 2, background: schedBg, color: '#64748b', borderTop: '2px solid #cbd5e1' }}>
                      {item.quantity_uom || '—'}
                    </td>
                    <td style={{ ...td(HRS_W, 'right'), position: 'sticky', left: L5, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', padding: '1px 3px' }}>
                      <input type="text"
                        defaultValue={estHrs > 0 ? Math.round(estHrs).toLocaleString() : ''}
                        key={`esthrs-${item.id}-${estHrs}`}
                        onFocus={e => { e.target.value = estHrs > 0 ? String(estHrs) : ''; e.target.select(); }}
                        onBlur={e => {
                          handleItemFieldSave(item, 'total_est_hours', e.target.value);
                          const n = parseFloat(e.target.value);
                          if (!isNaN(n) && n > 0) e.target.value = Math.round(n).toLocaleString();
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'right', fontSize: 12, color: '#374151', outline: 'none', padding: '0 3px' }}
                      />
                    </td>
                    <td style={{ ...td(START_W, 'center'), position: 'sticky', left: L6, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', padding: '1px 2px' }}>
                      <input type="date"
                        defaultValue={effStart?.slice(0, 10) ?? ''}
                        key={`start-${item.id}-${effStart}`}
                        onBlur={e => handleItemFieldSave(item, 'start_date', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 10, color: '#374151', outline: 'none', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ ...td(FINISH_W, 'center'), position: 'sticky', left: L7, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', padding: '1px 2px' }}>
                      <input type="date"
                        defaultValue={effEnd?.slice(0, 10) ?? ''}
                        key={`end-${item.id}-${effEnd}`}
                        onBlur={e => handleItemFieldSave(item, 'end_date', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 10, color: '#374151', outline: 'none', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ ...td(CONTOUR_W, 'center'), position: 'sticky', left: L8, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', padding: '1px 2px' }}>
                      <select
                        value={effContour || 'flat'}
                        onChange={e => handleItemFieldSave(item, 'contour_type', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 10, color: '#374151', outline: 'none', cursor: 'pointer' }}
                      >
                        {contourOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...td(REMQTY_W, 'right'), position: 'sticky', left: L9, zIndex: 2, background: schedBg, color: remQty === 0 ? '#16a34a' : '#475569', fontWeight: remQty === 0 ? 600 : 400, borderTop: '2px solid #cbd5e1' }}>
                      {remQty !== null ? fmt1(remQty) : '—'}
                    </td>
                    <td style={{ ...td(UNALLOC_W, 'right'), position: 'sticky', left: L10, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', boxShadow: freezeShadow, borderRight: 'none',
                      color: unallocatedQty === null ? '#c7d2fe' : unallocatedQty === 0 ? '#16a34a' : unallocatedQty < 0 ? '#dc2626' : '#d97706',
                      fontWeight: unallocatedQty !== null && unallocatedQty !== 0 ? 600 : 400 }}>
                      {unallocatedQty !== null ? fmt1(unallocatedQty) : '—'}
                    </td>
                    {weeks.map(w => {
                      const schedQtyW  = scheduledQtyByItem[item.id]?.[w]  || 0;
                      const schedHrsW  = scheduledHrsByItem[item.id]?.[w]  || 0;
                      const schedCostW = scheduledCostByItem[item.id]?.[w] || 0;
                      const s = metric === 'qty' ? schedQtyW : metric === 'hours' ? schedHrsW : schedCostW;
                      const isCurrentWeek = w === TODAY;
                      // In manual qty mode, week cells in the scheduled row are editable
                      if (isManual && metric === 'qty') {
                        const manualVal = localManualQty[item.id]?.[w] ?? item.manual_monthly_qty?.[w] ?? 0;
                        return (
                          <td key={w} style={{ ...td(WEEK_W, 'right'), background: isCurrentWeek ? '#dbeafe' : schedBg, padding: '2px 3px', borderTop: isCurrentWeek ? '2px solid #7c3aed' : '2px solid #cbd5e1' }}>
                            <input
                              type="number" min="0" step="any"
                              defaultValue={manualVal > 0 ? manualVal : ''}
                              key={`msched-${item.id}-${w}-${manualVal}`}
                              onBlur={e => handleManualQtyEdit(item, w, e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'right', fontSize: 12, outline: 'none', color: '#7c3aed', padding: '0 3px' }}
                            />
                          </td>
                        );
                      }
                      return (
                        <td key={w} style={{ ...td(WEEK_W, 'right'), background: isCurrentWeek ? '#dbeafe' : schedBg, color: '#475569', paddingRight: 6, borderTop: isCurrentWeek ? '2px solid #3b82f6' : '2px solid #cbd5e1' }}>
                          {s > 0 ? (metric === 'cost' ? fmtCost(s) : fmt1(s)) : <span style={{ color: '#c7d2fe' }}>—</span>}
                        </td>
                      );
                    })}
                  </tr>

                  {/* ── Actual row ── */}
                  <tr>
                    <td style={{ ...td(LABEL_W, 'center'), position: 'sticky', left: L0, zIndex: 2, background: actualBg, color: '#6b7280', fontSize: 10, fontStyle: 'italic' }}>
                      actual
                    </td>
                    <td style={{ ...td(NAME_W, 'left'), position: 'sticky', left: L1, zIndex: 2, background: actualBg, paddingLeft: 16, color: '#94a3b8', fontSize: 11 }}>
                      {hrsRate > 0 && <>{hrsRate.toFixed(3)} hrs/{item.quantity_uom || 'unit'}</>}
                    </td>
                    <td style={{ ...td(CT_W), position: 'sticky', left: L2, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(ESTQTY_W, 'right'), position: 'sticky', left: L3, zIndex: 2, background: actualBg }}>
                      {(() => {
                        const totalQty = weeks.reduce((s, w) => s + (getActualQty(item.id, w) ?? 0), 0);
                        if (metric === 'hours') {
                          const v = totalQty * hrsRate;
                          return v > 0 ? <span style={{ color: '#7c3aed', fontSize: 11, fontWeight: 600 }}>{fmt1(v)}</span> : null;
                        }
                        if (metric === 'cost') {
                          const v = totalQty * costRate;
                          return v > 0 ? <span style={{ color: '#0369a1', fontSize: 11, fontWeight: 600 }}>{fmtCost(v)}</span> : null;
                        }
                        return totalQty > 0 ? <span style={{ color: '#1e40af', fontSize: 11, fontWeight: 600 }}>{fmt1(totalQty)}</span> : null;
                      })()}
                    </td>
                    <td style={{ ...td(UOM_W), position: 'sticky', left: L4, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(HRS_W), position: 'sticky', left: L5, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(START_W), position: 'sticky', left: L6, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(FINISH_W), position: 'sticky', left: L7, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(CONTOUR_W), position: 'sticky', left: L8, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(REMQTY_W), position: 'sticky', left: L9, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(UNALLOC_W), position: 'sticky', left: L10, zIndex: 2, background: actualBg, boxShadow: freezeShadow, borderRight: 'none' }} />
                    {weeks.map(w => {
                      const actual     = getActualQty(item.id, w);
                      const schedQtyW  = scheduledQtyByItem[item.id]?.[w]  || 0;
                      const schedHrsW  = scheduledHrsByItem[item.id]?.[w]  || 0;
                      const schedCostW = scheduledCostByItem[item.id]?.[w] || 0;
                      const isPast     = w <= TODAY;
                      const hasEntry   = actual !== null;
                      const val        = actual ?? 0;
                      const earnedHrsW  = val * hrsRate;
                      const earnedCostW = val * costRate;
                      const schedMetricW  = metric === 'qty' ? schedQtyW : metric === 'hours' ? schedHrsW : schedCostW;
                      const earnedMetricW = metric === 'qty' ? val : metric === 'hours' ? earnedHrsW : earnedCostW;

                      const isCurrentWeek = w === TODAY;
                      let cellBg = actualBg;
                      if (hasEntry && schedMetricW > 0) {
                        cellBg = earnedMetricW >= schedMetricW ? '#bbf7d0' : '#fecaca';
                      } else if (hasEntry && val > 0) {
                        cellBg = '#bfdbfe';
                      } else if (isPast && schedQtyW > 0 && !hasEntry) {
                        cellBg = '#fef9c3';
                      }
                      if (isCurrentWeek && cellBg === actualBg) cellBg = '#dbeafe';

                      if (metric === 'qty') {
                        return (
                          <td key={w} style={{ ...td(WEEK_W, 'right'), background: cellBg, padding: '2px 3px', borderTop: isCurrentWeek ? '2px solid #3b82f6' : undefined }}>
                            <input
                              type="number" min="0" step="any"
                              placeholder={isPast && schedQtyW > 0 ? '0' : ''}
                              defaultValue={hasEntry && val > 0 ? val : ''}
                              key={`${item.id}-${w}-${val}`}
                              onBlur={e => handleCellBlur(item, w, e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              style={{
                                width: '100%', border: 'none', background: 'transparent',
                                textAlign: 'right', fontSize: 12, outline: 'none', color: '#1e40af',
                                padding: '0 3px',
                              }}
                            />
                          </td>
                        );
                      }
                      const displayVal  = metric === 'hours' ? earnedHrsW : earnedCostW;
                      const displayText = displayVal > 0
                        ? (metric === 'cost' ? fmtCost(displayVal) : fmt1(displayVal))
                        : '';
                      return (
                        <td key={w} style={{ ...td(WEEK_W, 'right'), background: cellBg, paddingRight: 6, borderTop: isCurrentWeek ? '2px solid #3b82f6' : undefined, color: '#1e40af', fontSize: 11 }}>
                          {displayText}
                        </td>
                      );
                    })}
                  </tr>

                  {/* ── Required (reforecast) row — flat spread of Rem Qty across future weeks ── */}
                  {showReqd && (
                    <tr>
                      <td style={{ ...td(LABEL_W, 'center'), position: 'sticky', left: L0, zIndex: 2, background: reqdBg, color: '#d97706', fontSize: 10, fontStyle: 'italic' }}>
                        reqd
                      </td>
                      <td style={{ ...td(NAME_W, 'left'), position: 'sticky', left: L1, zIndex: 2, background: reqdBg, paddingLeft: 16, color: '#92400e', fontSize: 11 }}>
                        {metric === 'qty' && `~${fmt1(remQty! / reqdWeekCount)}/${item.quantity_uom || 'unit'} per wk to finish on time`}
                        {metric === 'hours' && hrsRate > 0 && `~${fmt1((remQty! / reqdWeekCount) * hrsRate)} hrs per wk to finish on time`}
                        {metric === 'hours' && hrsRate === 0 && 'No productivity rate — cannot compute required hrs'}
                        {metric === 'cost' && costRate > 0 && `~${fmtCost((remQty! / reqdWeekCount) * costRate)} per wk to finish on time`}
                        {metric === 'cost' && costRate === 0 && 'No cost rate — cannot compute required cost'}
                      </td>
                      <td style={{ ...td(CT_W), position: 'sticky', left: L2, zIndex: 2, background: reqdBg }} />
                      <td style={{ ...td(ESTQTY_W), position: 'sticky', left: L3, zIndex: 2, background: reqdBg }} />
                      <td style={{ ...td(UOM_W), position: 'sticky', left: L4, zIndex: 2, background: reqdBg }} />
                      <td style={{ ...td(HRS_W), position: 'sticky', left: L5, zIndex: 2, background: reqdBg }} />
                      <td style={{ ...td(START_W), position: 'sticky', left: L6, zIndex: 2, background: reqdBg }} />
                      <td style={{ ...td(FINISH_W), position: 'sticky', left: L7, zIndex: 2, background: reqdBg }} />
                      <td style={{ ...td(CONTOUR_W), position: 'sticky', left: L8, zIndex: 2, background: reqdBg }} />
                      <td style={{ ...td(REMQTY_W, 'right'), position: 'sticky', left: L9, zIndex: 2, background: reqdBg, color: '#d97706', fontWeight: 600 }}>
                        {metric === 'qty'   && fmt1(remQty!)}
                        {metric === 'hours' && hrsRate > 0  && fmt1(remQty! * hrsRate)}
                        {metric === 'cost'  && costRate > 0 && fmtCost(remQty! * costRate)}
                      </td>
                      <td style={{ ...td(UNALLOC_W), position: 'sticky', left: L10, zIndex: 2, background: reqdBg, boxShadow: freezeShadow, borderRight: 'none' }} />
                      {weeks.map(w => {
                        const reqdQty = reqdMap[w];
                        if (!reqdQty) return <td key={w} style={{ ...td(WEEK_W), background: reqdBg }} />;
                        const reqdVal = metric === 'qty'   ? reqdQty
                                      : metric === 'hours' ? reqdQty * hrsRate
                                      : reqdQty * costRate;
                        const schedVal = metric === 'qty'   ? (scheduledQtyByItem[item.id]?.[w]  || 0)
                                       : metric === 'hours' ? (scheduledHrsByItem[item.id]?.[w]  || 0)
                                       : (scheduledCostByItem[item.id]?.[w] || 0);
                        if (reqdVal === 0) return <td key={w} style={{ ...td(WEEK_W), background: reqdBg }} />;
                        // Amber when required rate exceeds scheduled by >5% (behind); green when on track
                        const isBehind = schedVal > 0 && reqdVal > schedVal * 1.05;
                        const display  = metric === 'cost' ? fmtCost(reqdVal) : fmt1(reqdVal);
                        return (
                          <td key={w} style={{ ...td(WEEK_W, 'right'), background: reqdBg, paddingRight: 6,
                            color: isBehind ? '#b45309' : '#16a34a', fontWeight: 600 }}>
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>

          {/* Summary footer — rows change with metric toggle */}
          <tfoot>
            {metric === 'qty' && <>
              <SummaryRow label="Sched Qty"  weeks={weeks} getVal={w => totals.schedQty[w]  || 0} bg="#e0f2fe" color="#0369a1" l10={L10} />
              <SummaryRow label="Actual Qty" weeks={weeks} getVal={w => totals.actualQty[w] || 0} bg="#dbeafe" color="#1e40af" bold l10={L10} />
            </>}
            {metric === 'hours' && <>
              <SummaryRow label="Sched Hrs"  weeks={weeks} getVal={w => totals.schedHrs[w]  || 0} bg="#ede9fe" color="#6d28d9" l10={L10} />
              <SummaryRow label="Earned Hrs" weeks={weeks} getVal={w => totals.earnedHrs[w] || 0} bg="#fef3c7" color="#92400e" bold l10={L10} />
              <SummaryRow label="Burned Hrs" weeks={weeks} getVal={w => totals.burnedHrs[w] || 0} bg="#d1fae5" color="#065f46" l10={L10} />
              <SummaryRow label="Over/Under" weeks={weeks} getVal={w => (totals.earnedHrs[w] || 0) - (totals.burnedHrs[w] || 0)} bg="#f1f5f9" color="#111" signColored bold l10={L10} />
            </>}
            {metric === 'cost' && <>
              <SummaryRow label="Sched Cost"  weeks={weeks} getVal={w => totals.schedCost[w]  || 0} bg="#fef3c7" color="#92400e" dollar l10={L10} />
              <SummaryRow label="Earned Cost" weeks={weeks} getVal={w => totals.earnedCost[w] || 0} bg="#fef9c3" color="#b45309" bold dollar l10={L10} />
              <SummaryRow label="Burned Cost" weeks={weeks} getVal={w => totals.burnedCost[w] || 0} bg="#d1fae5" color="#065f46" dollar l10={L10} />
            </>}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── SummaryRow ────────────────────────────────────────────────────────────────

const FREEZE_SHADOW = '2px 0 0 0 #94a3b8';

function SummaryRow({ label, weeks, getVal, bg, color, signColored, bold, dollar, l10 }: {
  label: string; weeks: string[];
  getVal: (w: string) => number;
  bg: string; color: string;
  signColored?: boolean; bold?: boolean; dollar?: boolean;
  l10: number;
}) {
  return (
    <tr style={{ background: bg, position: 'sticky', bottom: 0 }}>
      {/* Frozen label cell spans all frozen columns up to the Unalloc shadow */}
      <td colSpan={10} style={{
        position: 'sticky', left: 0, zIndex: 3, background: bg,
        padding: '3px 8px 3px 4px', fontSize: 11, color, fontWeight: bold ? 700 : 600,
        textAlign: 'right', borderTop: '1px solid #cbd5e1',
      }}>
        {label}
      </td>
      <td style={{
        position: 'sticky', left: l10, zIndex: 3, background: bg,
        boxShadow: FREEZE_SHADOW, borderRight: 'none', borderTop: '1px solid #cbd5e1', padding: 0,
      }} />
      {weeks.map(w => {
        const v = getVal(w);
        const display = v === 0 ? '—'
          : dollar ? (signColored && v > 0 ? '+' : '') + '$' + Math.round(Math.abs(v)).toLocaleString()
          : (signColored && v > 0 ? '+' : '') + fmt1(v);
        const cellColor = signColored ? (v > 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#9ca3af') : color;
        return (
          <td key={w} style={{ padding: '3px 6px 3px 0', fontSize: 11, textAlign: 'right', color: cellColor, fontWeight: bold ? 700 : 400, borderTop: '1px solid #cbd5e1' }}>
            {display}
          </td>
        );
      })}
    </tr>
  );
}

// ── style helpers ─────────────────────────────────────────────────────────────

function th(width: number, align: 'left' | 'center' | 'right' = 'center'): React.CSSProperties {
  return { width, minWidth: width, maxWidth: width, padding: '0.35rem 0.4rem', textAlign: align, fontSize: '0.72rem', fontWeight: 600, borderRight: '1px solid #cbd5e1', borderBottom: '2px solid #94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', color: '#1e293b', background: '#eef2f7' };
}
function td(width: number, align: 'left' | 'center' | 'right' = 'center'): React.CSSProperties {
  return { width, minWidth: width, maxWidth: width, padding: '0.25rem 0.4rem', textAlign: align, fontSize: '0.75rem', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #f1f5f9' };
}
