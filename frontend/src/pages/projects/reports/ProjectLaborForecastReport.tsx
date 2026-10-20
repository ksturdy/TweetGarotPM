import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { vistaDataService } from '../../../services/vistaData';
import { projectsApi } from '../../../services/projects';
import {
  scheduleSegmentsService,
  SEGMENT_DEFINITIONS,
  type ScheduleSegment,
  type SegmentCosts,
} from '../../../services/scheduleSegments';
import { getContourMultipliers, type ContourType } from '../../../utils/contours';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

// ─── Types ────────────────────────────────────────────────────────────────────
type RemHrsMode = 'est-rate' | 'jtd-rate';
interface ShiftSetting { mon: number; tue: number; wed: number; thu: number; fri: number; sat: number; sun: number; }
type ShiftSettings = Record<string, ShiftSetting>;
const SHIFT_DAY_KEYS: (keyof ShiftSetting)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SHIFT_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DEFAULT_SHIFT: ShiftSetting = { mon: 8, tue: 8, wed: 8, thu: 8, fri: 8, sat: 0, sun: 0 };
const SHIFT_DEFAULTS: ShiftSettings = {
  '30': { ...DEFAULT_SHIFT }, '35': { ...DEFAULT_SHIFT },
  '40': { ...DEFAULT_SHIFT }, '45': { ...DEFAULT_SHIFT },
  '50': { ...DEFAULT_SHIFT }, '55': { ...DEFAULT_SHIFT },
  '70': { ...DEFAULT_SHIFT }, bas: { ...DEFAULT_SHIFT },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const weeklyHours = (s: ShiftSetting) => SHIFT_DAY_KEYS.reduce((sum, d) => sum + (s[d] ?? 0), 0);
const hoursPerPersonPerMonth = (s: ShiftSetting) => weeklyHours(s) * (52 / 12);
const safeN = (v: number | null | undefined) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const fmtCompact = (v: number | null | undefined) => {
  if (v == null || isNaN(v as number) || v === 0) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v)}`;
};
const fmt = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${(v * 100).toFixed(1)}%`;
const fmtNum = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
const fmtHrs = (v: number | null | undefined) =>
  v != null && !isNaN(v as number) ? Math.round(v).toLocaleString() : '—';
const fmtDateShort = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
};
const calcDur = (start: string | null, end: string | null) => {
  if (!start || !end) return '—';
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  if (days < 0) return '—';
  const months = Math.round(days / 30.44);
  return months >= 2 ? `${months}mo` : `${days}d`;
};

function calcRate(costs: SegmentCosts | undefined, mode: RemHrsMode): number | null {
  const estCost = safeN(costs?.est_cost), estHrs = safeN(costs?.est_hours);
  const jtdCost = safeN(costs?.jtd_cost), jtdHrs = safeN(costs?.jtd_hours);
  if (mode === 'est-rate') return estCost > 0 && estHrs > 0 ? estCost / estHrs : null;
  return jtdCost > 0 && jtdHrs > 0 ? jtdCost / jtdHrs : null;
}

function calcRemHrs(costs: SegmentCosts | undefined, mode: RemHrsMode): number | null {
  const estHrs = safeN(costs?.est_hours), jtdHrs = safeN(costs?.jtd_hours);
  if (estHrs <= 0) return null;
  if (mode === 'est-rate') return Math.max(0, estHrs - jtdHrs);
  const jtdCost = safeN(costs?.jtd_cost);
  if (jtdCost > 0 && jtdHrs > 0) {
    const projCost = safeN(costs?.projected_cost), remCost = projCost - jtdCost;
    return Math.max(0, remCost / (jtdCost / jtdHrs));
  }
  return Math.max(0, estHrs - jtdHrs);
}

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

const LABOR_CHART_COLORS: Record<string, string> = {
  '30': '#3b82f6', '35': '#1d4ed8',
  '40': '#0ea5e9', '45': '#0369a1',
  '50': '#06b6d4', '55': '#0e7490',
  '70': '#64748b', bas: '#8b5cf6',
};

const SEGMENT_COLOR: Record<string, string> = {
  '30': '#3b82f6', '35': '#3b82f6',
  '40': '#0ea5e9', '45': '#0ea5e9',
  '50': '#06b6d4', '55': '#06b6d4',
  '70': '#64748b', bas: '#8b5cf6',
  material: '#10b981', subcontract: '#f59e0b',
  rental: '#8b5cf6', equipment: '#ef4444', gc: '#6b7280',
};

// ─── Component ────────────────────────────────────────────────────────────────
const ProjectLaborForecastReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const { tenant } = useAuth();
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [remainingMode, setRemainingMode] = useState<RemHrsMode>('est-rate');
  const chartsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tenant?.settings?.branding?.logo_url) return;
    const token = localStorage.getItem('token');
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/tenant/logo', true);
    xhr.responseType = 'blob';
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status !== 200) return;
      const reader = new FileReader();
      reader.onloadend = () => setLogoDataUrl(reader.result as string);
      reader.readAsDataURL(xhr.response);
    };
    xhr.send();
  }, [tenant]);

  // Load shift settings from same localStorage key as CostTypeSchedule
  const shiftSettings = useMemo<ShiftSettings>(() => {
    const parse = (raw: string | null): ShiftSettings | null => {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        const firstVal = Object.values(parsed)[0] as any;
        if (firstVal && 'hoursPerDay' in firstVal) return null;
        return { ...SHIFT_DEFAULTS, ...parsed };
      } catch { return null; }
    };
    return parse(localStorage.getItem(`costTypeSchedule_shifts_${pid}`))
      ?? parse(localStorage.getItem('costTypeSchedule_shifts'))
      ?? { ...SHIFT_DEFAULTS };
  }, [pid]);

  const { data: project } = useQuery({
    queryKey: ['project', pid],
    queryFn: () => projectsApi.getById(pid).then(r => r.data),
    enabled: !!pid,
  });

  const { data: contract } = useQuery({
    queryKey: ['vista-contract', pid],
    queryFn: () => vistaDataService.getContractByProjectId(pid),
    enabled: !!pid,
  });

  const { data: costSummary } = useQuery({
    queryKey: ['phase-cost-summary', pid],
    queryFn: () => vistaDataService.getPhaseCodeCostSummary(pid),
    enabled: !!pid,
  });

  const { data: segmentsData } = useQuery({
    queryKey: ['schedule-segments', pid],
    queryFn: () => scheduleSegmentsService.getSegments(pid),
    enabled: !!pid,
  });

  const { data: costs = [] } = useQuery({
    queryKey: ['schedule-segment-costs', pid],
    queryFn: () => scheduleSegmentsService.getCosts(pid),
    enabled: !!pid,
  });

  const segments: ScheduleSegment[] = segmentsData?.segments ?? [];
  const activeKeys: string[] = segmentsData?.activeKeys ?? [];
  const segmentMap = useMemo(() => new Map(segments.map(s => [s.segment_key, s])), [segments]);
  const costsMap = useMemo(() => new Map((costs as SegmentCosts[]).map(c => [c.segment_key, c])), [costs]);

  // ── Timeline ──
  const allMonths = useMemo<Date[]>(() => {
    const allStarts = segments.map(s => s.start_date ? new Date(s.start_date.slice(0, 10)).getTime() : null).filter(Boolean) as number[];
    const allEnds   = segments.map(s => s.end_date   ? new Date(s.end_date.slice(0, 10)).getTime()   : null).filter(Boolean) as number[];
    if (!allStarts.length && !allEnds.length) return [];
    const tStart = allStarts.length ? Math.min(...allStarts) : Date.now();
    const tEnd   = allEnds.length   ? Math.max(...allEnds)   : tStart + 365 * 86400000;
    const months: Date[] = [];
    const cur = new Date(tStart); cur.setDate(1);
    const end = new Date(tEnd);
    while (cur <= end) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
    return months;
  }, [segments]);

  const todayIso = toIso(new Date());
  const clampStart = (s: string | null | undefined) => s && s < todayIso ? todayIso : (s ?? null);

  // ── Chart data ──
  const chartLabels = useMemo(() =>
    allMonths.map(m => m.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })),
    [allMonths]
  );

  const laborDatasets = useMemo(() => {
    return SEGMENT_DEFINITIONS
      .filter(d => d.isLabor && activeKeys.includes(d.key))
      .map(def => {
        const seg = segmentMap.get(def.key);
        const c = costsMap.get(def.key);
        const shift = shiftSettings[def.key] ?? SHIFT_DEFAULTS[def.key] ?? DEFAULT_SHIFT;
        const capacity = hoursPerPersonPerMonth(shift);
        const remHrs = calcRemHrs(c, remainingMode);
        const hours = remHrs != null && remHrs > 0
          ? distributeMonthly(remHrs, clampStart(seg?.start_date), seg?.end_date ?? null, seg?.contour_type ?? 'bell', allMonths)
          : allMonths.map(() => 0);
        const data = hours.map(h => capacity > 0 ? Math.round((h / capacity) * 10) / 10 : 0);
        return { label: def.label, data, color: LABOR_CHART_COLORS[def.key] ?? '#6b7280' };
      })
      .filter(ds => ds.data.some(v => v > 0));
  }, [activeKeys, segmentMap, costsMap, shiftSettings, remainingMode, allMonths]);

  const monthlyRevenue = useMemo(() => {
    const totalJtd = (costs as SegmentCosts[]).reduce((s, c) => s + safeN(c.jtd_cost), 0);
    const totalRem = (costs as SegmentCosts[]).reduce((s, c) => s + (safeN(c.projected_cost) - safeN(c.jtd_cost)), 0);
    const projCostFromSegs = totalJtd + totalRem;
    const projRev = safeN(project?.projected_revenue);
    const revMultiplier = projRev > 0 && projCostFromSegs > 0 ? projRev / projCostFromSegs : 0;

    const monthlyTotalCost = allMonths.map((_, i) =>
      SEGMENT_DEFINITIONS.reduce((sum, def) => {
        if (!activeKeys.includes(def.key)) return sum;
        const seg = segmentMap.get(def.key);
        const c = costsMap.get(def.key);
        const rem = safeN(c?.projected_cost) - safeN(c?.jtd_cost);
        if (rem <= 0) return sum;
        const monthly = distributeMonthly(rem, clampStart(seg?.start_date), seg?.end_date ?? null, seg?.contour_type ?? 'bell', allMonths);
        return sum + (monthly[i] ?? 0);
      }, 0)
    );
    return monthlyTotalCost.map(c => c * revMultiplier);
  }, [costs, project, activeKeys, segmentMap, costsMap, allMonths]);

  // ── Totals ──
  const totalEst = (costs as SegmentCosts[]).reduce((s, c) => s + safeN(c.est_cost), 0);
  const totalJtd = (costs as SegmentCosts[]).reduce((s, c) => s + safeN(c.jtd_cost), 0);
  const totalRem = (costs as SegmentCosts[]).reduce((s, c) => s + (safeN(c.projected_cost) - safeN(c.jtd_cost)), 0);
  const hasCharts = allMonths.length > 0 && (laborDatasets.length > 0 || monthlyRevenue.some(v => v > 0));

  // ── Vista trade hours (keep existing) ──
  const trades = useMemo(() => {
    if (!contract) return [];
    const pfEstCost  = costSummary?.labor?.find(l => l.trade === 'pf')?.est_cost ?? null;
    const pfJtdCost  = costSummary?.labor?.find(l => l.trade === 'pf')?.jtd_cost ?? null;
    const pfProjCost = costSummary?.labor?.find(l => l.trade === 'pf')?.projected_cost ?? null;
    const smEstCost  = costSummary?.labor?.find(l => l.trade === 'sm')?.est_cost ?? null;
    const smJtdCost  = costSummary?.labor?.find(l => l.trade === 'sm')?.jtd_cost ?? null;
    const smProjCost = costSummary?.labor?.find(l => l.trade === 'sm')?.projected_cost ?? null;
    const plEstCost  = costSummary?.labor?.find(l => l.trade === 'pl')?.est_cost ?? null;
    const plJtdCost  = costSummary?.labor?.find(l => l.trade === 'pl')?.jtd_cost ?? null;
    const plProjCost = costSummary?.labor?.find(l => l.trade === 'pl')?.projected_cost ?? null;
    const totEstCost  = costSummary?.labor_totals?.est_cost ?? null;
    const totJtdCost  = costSummary?.labor_totals?.jtd_cost ?? null;
    const totProjCost = costSummary?.labor_totals?.projected_cost ?? null;
    return [
      { label: 'Pipefitter',   estHrs: contract.pf_hours_estimate, jtdHrs: contract.pf_hours_jtd, projHrs: contract.pf_hours_projected, estCost: pfEstCost, jtdCost: pfJtdCost, projCost: pfProjCost, isTotal: false },
      { label: 'Sheet Metal',  estHrs: contract.sm_hours_estimate, jtdHrs: contract.sm_hours_jtd, projHrs: contract.sm_hours_projected, estCost: smEstCost, jtdCost: smJtdCost, projCost: smProjCost, isTotal: false },
      { label: 'Plumbing',     estHrs: contract.pl_hours_estimate, jtdHrs: contract.pl_hours_jtd, projHrs: contract.pl_hours_projected, estCost: plEstCost, jtdCost: plJtdCost, projCost: plProjCost, isTotal: false },
      { label: 'Total',        estHrs: contract.total_hours_estimate, jtdHrs: contract.total_hours_jtd, projHrs: contract.total_hours_projected, estCost: totEstCost, jtdCost: totJtdCost, projCost: totProjCost, isTotal: true },
    ];
  }, [contract, costSummary]);

  const totals = trades.find(t => t.isTotal);
  const laborRate = contract?.actual_labor_rate != null ? Number(contract.actual_labor_rate) : null;

  // ── PDF Export ──
  async function handleExportPdf() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const orange: [number, number, number] = [249, 115, 22];
    const navy: [number, number, number] = [15, 23, 42];
    const gray: [number, number, number] = [100, 116, 139];
    const margin = 36;

    const addFooter = () => {
      doc.setFontSize(7); doc.setTextColor(...gray);
      doc.text(`${project?.name ?? ''} — Labor Forecast Report`, margin, H - 12);
      doc.text('Page 1 of 1', W - margin, H - 12, { align: 'right' });
      doc.text(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), W / 2, H - 12, { align: 'center' });
    };

    doc.setFillColor(...orange);
    doc.rect(0, 0, W, 6, 'F');

    let y = 20;
    if (logoDataUrl) {
      try { doc.addImage(logoDataUrl, 'PNG', margin, y, 0, 24); } catch {}
      y += 30;
    }

    doc.setFontSize(8); doc.setTextColor(...gray);
    doc.text(project?.name ?? '', margin, y);
    y += 12;
    doc.setFontSize(16); doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.text('Labor Forecast Report', margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');

    // Stats bar inline with title
    const stats = [
      { label: 'EST',   value: fmtCompact(totalEst), color: navy },
      { label: 'JTD',   value: fmtCompact(totalJtd), color: [59, 130, 246] as [number, number, number] },
      { label: 'REM',   value: fmtCompact(totalRem), color: [16, 185, 129] as [number, number, number] },
      { label: 'TYPES', value: String(costs.length), color: gray },
    ];
    stats.forEach((s, i) => {
      const x = margin + i * 78;
      doc.setFontSize(6); doc.setTextColor(...gray); doc.text(s.label, x, y + 6);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...s.color);
      doc.text(s.value, x, y + 14);
      doc.setFont('helvetica', 'normal');
    });
    y += 22;

    // Capture charts — cap at 155pt so tables fit below
    if (chartsRef.current && hasCharts) {
      try {
        const canvas = await html2canvas(chartsRef.current, { scale: 1.5, backgroundColor: '#ffffff', useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const availW = W - margin * 2;
        const naturalH = (canvas.height / canvas.width) * availW;
        const fitH = Math.min(naturalH, 155);
        const fitW = (fitH / naturalH) * availW;
        doc.addImage(imgData, 'PNG', margin, y, fitW, fitH);
        y += fitH + 8;
      } catch {}
    }

    // Labor hrs method note
    doc.setFontSize(7); doc.setTextColor(...gray);
    doc.text(`Labor Hrs Method: ${remainingMode === 'est-rate' ? 'Est Rate' : 'JTD Rate'}`, margin, y);
    y += 10;

    // Build rows for cost type table
    type Row = string[];
    const tableRows: Row[] = [];
    let lastGroup = '';
    SEGMENT_DEFINITIONS.forEach(def => {
      if (!activeKeys.includes(def.key)) return;
      const group = def.isLabor ? 'LABOR' : 'NON-LABOR';
      if (group !== lastGroup) {
        tableRows.push([group, '', '', '', '', '', '']); // group header row
        lastGroup = group;
      }
      const seg = segmentMap.get(def.key);
      const c = costsMap.get(def.key);
      const remHrs = def.isLabor ? calcRemHrs(c, remainingMode) : null;
      const remCost = safeN(c?.projected_cost) - safeN(c?.jtd_cost);
      const rate = def.isLabor ? calcRate(c, remainingMode) : null;
      tableRows.push([
        def.label,
        def.isLabor && remHrs != null ? fmtHrs(Math.max(0, remHrs)) : '—',
        remCost > 0 ? fmtCompact(remCost) : '—',
        rate != null ? `$${Math.round(rate)}` : '—',
        fmtDateShort(seg?.start_date),
        fmtDateShort(seg?.end_date),
        calcDur(seg?.start_date ?? null, seg?.end_date ?? null),
      ]);
    });

    autoTable(doc, {
      startY: y,
      head: [['Cost Type', 'Rem Hrs', 'Rem $', 'Est $/hr', 'Start', 'End', 'Dur']],
      body: tableRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 42, 60], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
      didParseCell: (data) => {
        const row = tableRows[data.row.index];
        if (row && (row[0] === 'LABOR' || row[0] === 'NON-LABOR') && data.section === 'body') {
          data.cell.styles.fillColor = [238, 242, 247];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [30, 42, 60];
        }
      },
    });

    const afterCostTable = (doc as any).lastAutoTable.finalY + 8;

    // Vista trade hours table
    if (trades.length > 0) {
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...navy);
      doc.text('Labor Hours by Trade (Vista)', margin, afterCostTable + 6);

      const tradeRows = trades.map(t => {
        const remainHrs = t.projHrs != null && t.jtdHrs != null ? t.projHrs - t.jtdHrs : null;
        const variance = t.projCost != null && t.estCost != null ? t.projCost - t.estCost : null;
        return [
          t.label,
          fmtNum(t.estHrs), fmtNum(t.jtdHrs), fmtNum(t.projHrs), fmtNum(remainHrs),
          fmt(t.estCost), fmt(t.jtdCost), fmt(t.projCost),
          variance != null ? `${variance >= 0 ? '+' : ''}${fmt(variance)}` : '—',
          fmtPct(t.projCost != null && t.estCost != null && t.estCost !== 0 ? (t.projCost - t.estCost) / t.estCost : null),
        ];
      });

      autoTable(doc, {
        startY: afterCostTable + 14,
        head: [['Trade', 'Est Hrs', 'JTD Hrs', 'Proj Hrs', 'Rem Hrs', 'Est Cost', 'JTD Cost', 'Proj Cost', 'Variance $', 'Variance %']],
        body: tradeRows,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 2.5 },
        headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
        didParseCell: (data) => {
          const row = tradeRows[data.row.index];
          if (row && row[0] === 'Total' && data.section === 'body') {
            data.cell.styles.fillColor = [248, 250, 252];
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
    }

    addFooter();

    doc.save(`labor-forecast-${projectId}.pdf`);
  }

  // ── Chart options ──
  const chartScales = {
    x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 as const }, maxRotation: 45 as const, color: '#64748b' } },
  };

  const modeBtn = (active: boolean): React.CSSProperties => ({
    padding: '0.3rem 0.65rem', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit',
    border: 'none', borderLeft: 'none',
    background: active ? '#1e3a5f' : 'white',
    color: active ? 'white' : '#1e293b',
  });

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 4 }}>{project?.name ?? ''}</div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Labor Forecast Report</h1>
        </div>
        <button
          onClick={handleExportPdf}
          style={{ padding: '8px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
        >
          Export PDF
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[
          { label: 'Est',   value: fmtCompact(totalEst), color: '#0f172a' },
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

      {/* Charts + Shift Schedule */}
      {hasCharts && (
        <div ref={chartsRef} style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start', marginBottom: '1rem' }}>

          {/* Shift Schedule (read-only) */}
          <div style={{ flexShrink: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 0.75rem', background: '#eef2f7', borderBottom: '1px solid #e2e8f0', fontSize: '0.68rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Shift Schedule
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0.25rem 0.75rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <span style={{ flex: 1, fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trade</span>
              {SHIFT_DAY_LABELS.map((lbl, i) => (
                <span key={i} style={{ width: 24, textAlign: 'center', fontSize: '0.6rem', fontWeight: 700, color: i >= 5 ? '#f59e0b' : '#64748b', flexShrink: 0 }}>{lbl}</span>
              ))}
              <span style={{ width: 36, textAlign: 'right', fontSize: '0.6rem', color: '#94a3b8', flexShrink: 0 }}>Wk</span>
            </div>
            {SEGMENT_DEFINITIONS.filter(d => d.isLabor && activeKeys.includes(d.key)).map((def, ri) => {
              const shift = shiftSettings[def.key] ?? DEFAULT_SHIFT;
              const total = weeklyHours(shift);
              return (
                <div key={def.key} style={{ display: 'flex', alignItems: 'center', padding: '0.28rem 0.75rem', borderBottom: '1px solid #f1f5f9', background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 110 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: LABOR_CHART_COLORS[def.key] ?? '#6b7280', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: '0.7rem', color: '#374151', whiteSpace: 'nowrap' }}>{def.label}</span>
                  </div>
                  {SHIFT_DAY_KEYS.map((day, di) => (
                    <span key={day} style={{ width: 24, textAlign: 'center', fontSize: '0.7rem', flexShrink: 0, color: shift[day] === 0 ? '#cbd5e1' : di >= 5 ? '#d97706' : '#1e293b' }}>
                      {shift[day]}
                    </span>
                  ))}
                  <span style={{ width: 36, textAlign: 'right', fontSize: '0.7rem', fontWeight: 600, color: '#3b82f6', flexShrink: 0 }}>{total}h</span>
                </div>
              );
            })}
          </div>

          {/* Remaining Labor Resources chart */}
          {laborDatasets.length > 0 && (
            <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.875rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Remaining Labor Resources by Month
              </div>
              <div style={{ height: 200, position: 'relative' }}>
                <Line
                  data={{
                    labels: chartLabels,
                    datasets: laborDatasets.map(ds => ({
                      label: ds.label,
                      data: ds.data,
                      borderColor: ds.color,
                      backgroundColor: ds.color + '18',
                      tension: 0.4,
                      pointRadius: 0,
                      pointHoverRadius: 5,
                      borderWidth: 2,
                      fill: false,
                    })),
                  }}
                  options={{
                    maintainAspectRatio: false, responsive: true,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                      legend: { display: laborDatasets.length > 1, position: 'top', labels: { boxWidth: 12, boxHeight: 2, font: { size: 10 }, padding: 8, usePointStyle: true, pointStyleWidth: 12 } },
                      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(1)} workers` } },
                    },
                    scales: { ...chartScales, y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 9 }, color: '#64748b', stepSize: 1 } } },
                  }}
                />
              </div>
            </div>
          )}

          {/* Revenue by Month chart */}
          {monthlyRevenue.some(v => v > 0) && (
            <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.875rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Revenue by Month
              </div>
              <div style={{ height: 200, position: 'relative' }}>
                <Bar
                  data={{
                    labels: chartLabels,
                    datasets: [{
                      label: 'Revenue',
                      data: monthlyRevenue,
                      backgroundColor: '#10b981' + '70',
                      borderColor: '#10b981',
                      borderWidth: 1,
                      borderRadius: 2,
                    }],
                  }}
                  options={{
                    maintainAspectRatio: false, responsive: true,
                    plugins: {
                      legend: { display: false },
                      tooltip: { callbacks: { label: ctx => `Revenue: ${fmtCompact(ctx.parsed.y)}` } },
                    },
                    scales: { ...chartScales, y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 9 }, color: '#64748b', callback: (v) => fmtCompact(v as number) } } },
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Labor Hrs mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Labor Hrs:</span>
        <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
          <button onClick={() => setRemainingMode('est-rate')} style={modeBtn(remainingMode === 'est-rate')}
            title="(Proj Cost − JTD Cost) ÷ Estimated labor rate">Est Rate</button>
          <button onClick={() => setRemainingMode('jtd-rate')} style={{ ...modeBtn(remainingMode === 'jtd-rate'), borderLeft: '1px solid #e2e8f0' }}
            title="(Proj Cost − JTD Cost) ÷ JTD labor rate">JTD Rate</button>
        </div>
      </div>

      {/* Cost Type Schedule table */}
      {activeKeys.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.625rem 1rem', background: '#eef2f7', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>
            Cost Type Schedule
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Cost Type', 'Rem Hrs', 'Rem $', 'Est $/hr', 'Start', 'End', 'Dur'].map(h => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: h === 'Cost Type' ? 'left' : 'right', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: React.ReactNode[] = [];
                  let lastGroup = '';
                  SEGMENT_DEFINITIONS.forEach(def => {
                    if (!activeKeys.includes(def.key)) return;
                    const group = def.isLabor ? 'LABOR' : 'NON-LABOR';
                    if (group !== lastGroup) {
                      rows.push(
                        <tr key={group} style={{ background: '#eef2f7' }}>
                          <td colSpan={7} style={{ padding: '5px 12px', fontWeight: 700, fontSize: '0.7rem', color: '#475569', letterSpacing: '0.06em' }}>
                            {group}
                          </td>
                        </tr>
                      );
                      lastGroup = group;
                    }
                    const seg = segmentMap.get(def.key);
                    const c = costsMap.get(def.key);
                    const remHrs = def.isLabor ? calcRemHrs(c, remainingMode) : null;
                    const remCost = safeN(c?.projected_cost) - safeN(c?.jtd_cost);
                    const rate = def.isLabor ? calcRate(c, remainingMode) : null;
                    const color = SEGMENT_COLOR[def.key] ?? '#6b7280';
                    rows.push(
                      <tr key={def.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '7px 12px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0, display: 'inline-block' }} />
                          {def.label}
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: '#475569' }}>{def.isLabor && remHrs != null ? fmtHrs(Math.max(0, remHrs)) : '—'}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: remCost < 0 ? '#ef4444' : '#475569' }}>{remCost > 0 ? fmtCompact(remCost) : '—'}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: '#475569' }}>{rate != null ? `$${Math.round(rate)}` : '—'}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDateShort(seg?.start_date)}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDateShort(seg?.end_date)}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: '#475569' }}>{calcDur(seg?.start_date ?? null, seg?.end_date ?? null)}</td>
                      </tr>
                    );
                  });
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vista trade hours */}
      {trades.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '0.625rem 1rem', background: '#eef2f7', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>
            Labor Hours by Trade (Vista)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Trade', 'Est Hours', 'JTD Hours', 'Proj Hours', 'Remaining Hrs', 'Est Cost', 'JTD Cost', 'Proj Cost', 'Variance ($)', 'Variance (%)'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Trade' ? 'left' : 'right', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((row, idx) => {
                  const remainHrs = row.projHrs != null && row.jtdHrs != null ? row.projHrs - row.jtdHrs : null;
                  const variance = row.projCost != null && row.estCost != null ? row.projCost - row.estCost : null;
                  const variancePct = row.estCost != null && row.estCost !== 0 && row.projCost != null
                    ? (row.projCost - row.estCost) / row.estCost : null;
                  const varColor = variance == null ? '#64748b' : variance > 0 ? '#ef4444' : '#10b981';
                  return (
                    <tr key={row.label} style={{ background: row.isTotal ? '#f8fafc' : idx % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: '1px solid #f1f5f9', fontWeight: row.isTotal ? 600 : 400 }}>
                      <td style={{ padding: '9px 14px', color: '#1e293b' }}>{row.label}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#475569' }}>{fmtNum(row.estHrs)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#475569' }}>{fmtNum(row.jtdHrs)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#1e293b' }}>{fmtNum(row.projHrs)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: remainHrs != null && remainHrs < 0 ? '#ef4444' : '#475569' }}>{fmtNum(remainHrs)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#475569' }}>{fmt(row.estCost)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#475569' }}>{fmt(row.jtdCost)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#1e293b' }}>{fmt(row.projCost)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: varColor, fontWeight: 500 }}>
                        {variance != null ? `${variance >= 0 ? '+' : ''}${fmt(variance)}` : '—'}
                      </td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: varColor, fontWeight: 500 }}>{fmtPct(variancePct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!contract && activeKeys.length === 0 && (
        <div style={{ marginTop: '2rem', padding: '2rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          No schedule or Vista data found for this project.
        </div>
      )}
    </div>
  );
};

export default ProjectLaborForecastReport;
