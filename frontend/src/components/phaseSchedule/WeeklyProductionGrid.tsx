import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
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

// ── helpers ───────────────────────────────────────────────────────────────────

function toSunday(d: Date): Date {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  return s;
}
function ymd(d: Date): string { return format(d, 'yyyy-MM-dd'); }
function parseNum(v: unknown): number { const n = Number(v); return isFinite(n) ? n : 0; }
function fmt1(n: number): string { return n === 0 ? '—' : n % 1 === 0 ? n.toLocaleString() : n.toFixed(1); }

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

  // Use parent-supplied filtered items if provided; fall back to API items.
  // Labor-only filtering is enforced by the backend when externalItems is absent.
  const items = useMemo(() => {
    let base = externalItems
      ? externalItems.filter(item => item.cost_types?.includes(1))
      : (data?.items ?? []);
    if (hideNoQty) base = base.filter(item => parseNum(item.quantity) > 0);
    return base;
  }, [externalItems, data, hideNoQty]);

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
          schedByWeek[w]  = (schedByWeek[w]  || 0) + (scheduledHrsByItem[item.id]?.[w]  || 0);
          earnedByWeek[w] = (earnedByWeek[w] || 0) + actual * hrsRate;
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
        schedHrs[w]   = (schedHrs[w]   || 0) + (scheduledHrsByItem[item.id]?.[w]  || 0);
        earnedHrs[w]  = (earnedHrs[w]  || 0) + a * hrsRate;
        burnedHrs[w]  = (burnedHrs[w]  || 0) + getBurnedHours(item.id, w);
        schedCost[w]  = (schedCost[w]  || 0) + (scheduledCostByItem[item.id]?.[w] || 0);
        earnedCost[w] = (earnedCost[w] || 0) + a * costRate;
        burnedCost[w] = (burnedCost[w] || 0) + getBurnedCost(item.id, w);
      });
    });
    return { schedQty, actualQty, schedHrs, earnedHrs, burnedHrs, schedCost, earnedCost, burnedCost };
  }, [items, weeks, scheduledQtyByItem, scheduledHrsByItem, scheduledCostByItem, getActualQty, getBurnedHours, getBurnedCost]);

  // ── layout constants ──────────────────────────────────────────────────────

  const WEEK_W     = 72;
  const LABEL_W    = 54;
  const NAME_W     = 170;
  const START_W    = 72;
  const FINISH_W   = 72;
  const CONTOUR_W  = 56;
  const ESTQTY_W   = 60;
  const UOM_W      = 44;
  const HRS_W      = 56;
  const REMQTY_W   = 52;
  const UNALLOC_W  = 52;
  // Column order: # | Phase Name | Start | Finish | Contour | Est Qty | UOM | Est Hrs | Rem Qty | Unalloc ||
  const FIXED_W    = LABEL_W + NAME_W + START_W + FINISH_W + CONTOUR_W + ESTQTY_W + UOM_W + HRS_W + REMQTY_W + UNALLOC_W;

  // Left offsets for sticky columns
  const L0 = 0;
  const L1 = LABEL_W;
  const L2 = L1 + NAME_W;
  const L3 = L2 + START_W;
  const L4 = L3 + FINISH_W;
  const L5 = L4 + CONTOUR_W;
  const L6 = L5 + ESTQTY_W;
  const L7 = L6 + UOM_W;
  const L8 = L7 + HRS_W;
  const L9 = L8 + REMQTY_W;

  // Freeze shadow on the right edge of the UOM (last frozen) column.
  // box-shadow travels with the sticky element; borderRight would be clipped.
  const freezeShadow = '2px 0 0 0 #94a3b8';

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
            <col style={{ width: START_W }} />
            <col style={{ width: FINISH_W }} />
            <col style={{ width: CONTOUR_W }} />
            <col style={{ width: ESTQTY_W }} />
            <col style={{ width: UOM_W }} />
            <col style={{ width: HRS_W }} />
            <col style={{ width: REMQTY_W }} />
            <col style={{ width: UNALLOC_W }} />
            {weeks.map(w => <col key={w} style={{ width: WEEK_W }} />)}
          </colgroup>

          {/* Sticky header */}
          <thead>
            <tr style={{ background: '#1e3a5f', color: '#fff' }}>
              <th style={{ ...th(LABEL_W),           position: 'sticky', top: 0, left: L0, zIndex: 41, background: '#1e3a5f' }}>#</th>
              <th style={{ ...th(NAME_W, 'left'),    position: 'sticky', top: 0, left: L1, zIndex: 41, background: '#1e3a5f' }}>Phase Name</th>
              <th style={{ ...th(START_W),           position: 'sticky', top: 0, left: L2, zIndex: 41, background: '#1e3a5f' }}>Start</th>
              <th style={{ ...th(FINISH_W),          position: 'sticky', top: 0, left: L3, zIndex: 41, background: '#1e3a5f' }}>Finish</th>
              <th style={{ ...th(CONTOUR_W),         position: 'sticky', top: 0, left: L4, zIndex: 41, background: '#1e3a5f' }}>Contour</th>
              <th style={{ ...th(ESTQTY_W),          position: 'sticky', top: 0, left: L5, zIndex: 41, background: '#1e3a5f' }}>Est Qty</th>
              <th style={{ ...th(UOM_W),             position: 'sticky', top: 0, left: L6, zIndex: 41, background: '#1e3a5f' }}>UOM</th>
              <th style={{ ...th(HRS_W),             position: 'sticky', top: 0, left: L7, zIndex: 41, background: '#1e3a5f' }}>Est Hrs</th>
              <th style={{ ...th(REMQTY_W),          position: 'sticky', top: 0, left: L8, zIndex: 41, background: '#1e3a5f' }}>Rem Qty</th>
              <th style={{ ...th(UNALLOC_W),         position: 'sticky', top: 0, left: L9, zIndex: 41, background: '#1e3a5f', boxShadow: freezeShadow, borderRight: 'none' }}>Unalloc</th>
              {weeks.map(w => (
                <th key={w} style={{ ...th(WEEK_W), position: 'sticky', top: 0, zIndex: 30, background: w === TODAY ? '#2d4a6e' : '#1e3a5f' }}>
                  {format(parseISO(w), 'M/d')}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={10 + weeks.length} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
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
                    <td style={{ ...td(NAME_W, 'left'), position: 'sticky', left: L1, zIndex: 2, background: schedBg, paddingLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: '#1e3a5f', borderTop: '2px solid #cbd5e1' }}
                      title={item.name}>
                      {item.name}
                    </td>
                    <td style={{ ...td(START_W, 'center'), position: 'sticky', left: L2, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', padding: '1px 2px' }}>
                      <input type="date"
                        defaultValue={effStart?.slice(0, 10) ?? ''}
                        key={`start-${item.id}-${effStart}`}
                        onBlur={e => handleItemFieldSave(item, 'start_date', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 10, color: '#374151', outline: 'none', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ ...td(FINISH_W, 'center'), position: 'sticky', left: L3, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', padding: '1px 2px' }}>
                      <input type="date"
                        defaultValue={effEnd?.slice(0, 10) ?? ''}
                        key={`end-${item.id}-${effEnd}`}
                        onBlur={e => handleItemFieldSave(item, 'end_date', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 10, color: '#374151', outline: 'none', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ ...td(CONTOUR_W, 'center'), position: 'sticky', left: L4, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', padding: '1px 2px' }}>
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
                    <td style={{ ...td(ESTQTY_W, 'right'), position: 'sticky', left: L5, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', padding: '1px 3px' }}>
                      <input type="number" min="0" step="any"
                        defaultValue={qty > 0 ? qty : ''}
                        key={`estqty-${item.id}-${qty}`}
                        onBlur={e => handleItemFieldSave(item, 'quantity', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'right', fontSize: 12, color: '#374151', outline: 'none', padding: '0 3px' }}
                      />
                    </td>
                    <td style={{ ...td(UOM_W, 'center'), position: 'sticky', left: L6, zIndex: 2, background: schedBg, color: '#64748b', borderTop: '2px solid #cbd5e1' }}>
                      {item.quantity_uom || '—'}
                    </td>
                    <td style={{ ...td(HRS_W, 'right'), position: 'sticky', left: L7, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', padding: '1px 3px' }}>
                      <input type="number" min="0" step="any"
                        defaultValue={estHrs > 0 ? estHrs : ''}
                        key={`esthrs-${item.id}-${estHrs}`}
                        onBlur={e => handleItemFieldSave(item, 'total_est_hours', e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'right', fontSize: 12, color: '#374151', outline: 'none', padding: '0 3px' }}
                      />
                    </td>
                    <td style={{ ...td(REMQTY_W, 'right'), position: 'sticky', left: L8, zIndex: 2, background: schedBg, color: remQty === 0 ? '#16a34a' : '#475569', fontWeight: remQty === 0 ? 600 : 400, borderTop: '2px solid #cbd5e1' }}>
                      {remQty !== null ? fmt1(remQty) : '—'}
                    </td>
                    <td style={{ ...td(UNALLOC_W, 'right'), position: 'sticky', left: L9, zIndex: 2, background: schedBg, borderTop: '2px solid #cbd5e1', boxShadow: freezeShadow, borderRight: 'none',
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
                          {s > 0 ? fmt1(s) : <span style={{ color: '#c7d2fe' }}>—</span>}
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
                    <td style={{ ...td(START_W), position: 'sticky', left: L2, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(FINISH_W), position: 'sticky', left: L3, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(CONTOUR_W), position: 'sticky', left: L4, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(ESTQTY_W, 'right'), position: 'sticky', left: L5, zIndex: 2, background: actualBg }}>
                      {(() => {
                        const totalQty = weeks.reduce((s, w) => s + (getActualQty(item.id, w) ?? 0), 0);
                        if (metric === 'hours') {
                          const v = totalQty * hrsRate;
                          return v > 0 ? <span style={{ color: '#7c3aed', fontSize: 11, fontWeight: 600 }}>{fmt1(v)}</span> : null;
                        }
                        if (metric === 'cost') {
                          const v = totalQty * costRate;
                          return v > 0 ? <span style={{ color: '#0369a1', fontSize: 11, fontWeight: 600 }}>${fmt1(v)}</span> : null;
                        }
                        return totalQty > 0 ? <span style={{ color: '#1e40af', fontSize: 11, fontWeight: 600 }}>{fmt1(totalQty)}</span> : null;
                      })()}
                    </td>
                    <td style={{ ...td(UOM_W), position: 'sticky', left: L6, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(HRS_W), position: 'sticky', left: L7, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(REMQTY_W), position: 'sticky', left: L8, zIndex: 2, background: actualBg }} />
                    <td style={{ ...td(UNALLOC_W), position: 'sticky', left: L9, zIndex: 2, background: actualBg, boxShadow: freezeShadow, borderRight: 'none' }} />
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
                        ? (metric === 'cost' ? `$${fmt1(displayVal)}` : fmt1(displayVal))
                        : '';
                      return (
                        <td key={w} style={{ ...td(WEEK_W, 'right'), background: cellBg, paddingRight: 6, borderTop: isCurrentWeek ? '2px solid #3b82f6' : undefined, color: '#1e40af', fontSize: 11 }}>
                          {displayText}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>

          {/* Summary footer — rows change with metric toggle */}
          <tfoot>
            {metric === 'qty' && <>
              <SummaryRow label="Sched Qty"  weeks={weeks} getVal={w => totals.schedQty[w]  || 0} bg="#e0f2fe" color="#0369a1" />
              <SummaryRow label="Actual Qty" weeks={weeks} getVal={w => totals.actualQty[w] || 0} bg="#dbeafe" color="#1e40af" bold />
            </>}
            {metric === 'hours' && <>
              <SummaryRow label="Sched Hrs"  weeks={weeks} getVal={w => totals.schedHrs[w]  || 0} bg="#ede9fe" color="#6d28d9" />
              <SummaryRow label="Earned Hrs" weeks={weeks} getVal={w => totals.earnedHrs[w] || 0} bg="#fef3c7" color="#92400e" bold />
              <SummaryRow label="Burned Hrs" weeks={weeks} getVal={w => totals.burnedHrs[w] || 0} bg="#d1fae5" color="#065f46" />
              <SummaryRow label="Over/Under" weeks={weeks} getVal={w => (totals.earnedHrs[w] || 0) - (totals.burnedHrs[w] || 0)} bg="#f1f5f9" color="#111" signColored bold />
            </>}
            {metric === 'cost' && <>
              <SummaryRow label="Sched Cost"  weeks={weeks} getVal={w => totals.schedCost[w]  || 0} bg="#fef3c7" color="#92400e" />
              <SummaryRow label="Earned Cost" weeks={weeks} getVal={w => totals.earnedCost[w] || 0} bg="#fef9c3" color="#b45309" bold />
              <SummaryRow label="Burned Cost" weeks={weeks} getVal={w => totals.burnedCost[w] || 0} bg="#d1fae5" color="#065f46" />
            </>}
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── SummaryRow ────────────────────────────────────────────────────────────────

const FREEZE_L = { L0: 0, L1: 54, L2: 224, L3: 296, L4: 368, L5: 424, L6: 484, L7: 528, L8: 584, L9: 636 };

const FREEZE_SHADOW = '2px 0 0 0 #94a3b8';

function SummaryRow({ label, weeks, getVal, bg, color, signColored, bold }: {
  label: string; weeks: string[];
  getVal: (w: string) => number;
  bg: string; color: string;
  signColored?: boolean; bold?: boolean;
}) {
  return (
    <tr style={{ background: bg, position: 'sticky', bottom: 0 }}>
      {/* Frozen label cell spans the first 3 columns */}
      <td colSpan={9} style={{
        position: 'sticky', left: FREEZE_L.L0, zIndex: 3, background: bg,
        padding: '3px 8px 3px 4px', fontSize: 11, color, fontWeight: bold ? 700 : 600,
        textAlign: 'right', borderTop: '1px solid #cbd5e1',
      }}>
        {label}
      </td>
      <td style={{
        position: 'sticky', left: FREEZE_L.L9, zIndex: 3, background: bg,
        boxShadow: FREEZE_SHADOW, borderRight: 'none', borderTop: '1px solid #cbd5e1', padding: 0,
      }} />
      {weeks.map(w => {
        const v = getVal(w);
        const display = v === 0 ? '—' : (signColored && v > 0 ? '+' : '') + fmt1(v);
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
  return { width, minWidth: width, maxWidth: width, padding: '5px 4px', textAlign: align, fontSize: 11, fontWeight: 600, borderRight: '1px solid #2d4a6e', whiteSpace: 'nowrap', overflow: 'hidden' };
}
function td(width: number, align: 'left' | 'center' | 'right' = 'center'): React.CSSProperties {
  return { width, minWidth: width, maxWidth: width, padding: '3px 4px', textAlign: align, fontSize: 12, borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #f1f5f9' };
}
