import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { useAuth } from '../../../context/AuthContext';
import { vistaDataService } from '../../../services/vistaData';
import { projectsApi } from '../../../services/projects';
import { rfisApi } from '../../../services/rfis';
import { submittalsApi } from '../../../services/submittals';
import { changeOrdersApi } from '../../../services/changeOrders';
import { fieldIssuesApi } from '../../../services/fieldIssues';
import { projectionNotesApi } from '../../../services/projectionNotes';
import { scheduleSegmentsService, SEGMENT_DEFINITIONS, type SegmentCosts, type ScheduleSegment } from '../../../services/scheduleSegments';
import { getContourMultipliers, type ContourType } from '../../../utils/contours';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

// ─── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
const fmtN = (v: number | string | null | undefined) => {
  if (v == null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
};
const fmtDate = (v: string | null | undefined) =>
  v == null ? '—' : new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtSigned = (v: number | string | null | undefined) => {
  if (v == null) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  const abs = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(n));
  return n >= 0 ? `+${abs}` : `(${abs})`;
};

const safeN = (v: number | null | undefined) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const fmtCompact = (v: number | null | undefined) => {
  if (v == null || isNaN(v as number) || v === 0) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(v / 1000)}K`;
  return `$${Math.round(v)}`;
};
const fmtHrs = (v: number | null | undefined) => v != null && !isNaN(v as number) ? Math.round(v).toLocaleString() : '—';
const fmtDateShort = (s: string | null | undefined) => {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${m}/${d}/${y.slice(2)}`;
};
const calcDurLabel = (start: string | null, end: string | null) => {
  if (!start || !end) return '—';
  const days = Math.round((new Date(end.slice(0, 10)).getTime() - new Date(start.slice(0, 10)).getTime()) / 86400000);
  if (days < 0) return '—';
  const months = Math.round(days / 30.44);
  return months >= 2 ? `${months}mo` : `${days}d`;
};
const calcRemHrsHealth = (costs: SegmentCosts | undefined) => {
  const estHrs = safeN(costs?.est_hours), jtdHrs = safeN(costs?.jtd_hours);
  if (estHrs <= 0) return null;
  return Math.max(0, estHrs - jtdHrs);
};
const calcRateHealth = (costs: SegmentCosts | undefined) => {
  const estCost = safeN(costs?.est_cost), estHrs = safeN(costs?.est_hours);
  return estCost > 0 && estHrs > 0 ? estCost / estHrs : null;
};

// ─── Shift / Chart helpers (shared with CostTypeSchedule) ─────────────────────
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
const weeklyHoursH = (s: ShiftSetting) => SHIFT_DAY_KEYS.reduce((sum, d) => sum + (s[d] ?? 0), 0);
const hrsPerPersonPerMonth = (s: ShiftSetting) => weeklyHoursH(s) * (52 / 12);
const LABOR_CHART_COLORS: Record<string, string> = {
  '30': '#3b82f6', '35': '#1d4ed8', '40': '#0ea5e9', '45': '#0369a1',
  '50': '#06b6d4', '55': '#0e7490', '70': '#64748b', bas: '#8b5cf6',
};
const toIsoH = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function distributeMonthlyH(
  remaining: number | null, startDate: string | null, endDate: string | null,
  contourType: string, allMonths: Date[]
): number[] {
  if (!remaining || !startDate || !endDate) return allMonths.map(() => 0);
  const start = new Date(startDate.slice(0, 10)), end = new Date(endDate.slice(0, 10));
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

// ─── Section definitions ───────────────────────────────────────────────────────

type SectionId =
  | 'health_summary'
  | 'financial_summary'
  | 'labor_hours'
  | 'labor_forecast'
  | 'gain_fade'
  | 'document_status'
  | 'issues_log'
  | 'change_order_log'
  | 'rfi_log'
  | 'submittal_log';

interface SectionDef {
  id: SectionId;
  label: string;
  description: string;
}

const SECTIONS: SectionDef[] = [
  { id: 'health_summary', label: 'Health Summary', description: 'Status overview — margin, labor, RFIs, submittals, issues, change orders' },
  { id: 'financial_summary', label: 'Financial Summary', description: 'Estimate vs projected vs JTD by cost category' },
  { id: 'labor_hours', label: 'Labor Hours', description: 'Hours by trade — Pipefitter, Sheet Metal, Plumbing' },
  { id: 'labor_forecast', label: 'Labor Forecast (Cost)', description: 'Projected labor cost and variance by trade' },
  { id: 'gain_fade', label: 'Gain / Fade', description: 'Projection notes entered in Financials' },
  { id: 'document_status', label: 'Document Status', description: 'Open/total count for RFIs, Submittals, COs, Issues' },
  { id: 'issues_log', label: 'Issues Log', description: 'Full field issues table with status and priority' },
  { id: 'change_order_log', label: 'Change Order Log', description: 'All change orders with status and amounts' },
  { id: 'rfi_log', label: 'RFI Log', description: 'All RFIs with status, priority, and due dates' },
  { id: 'submittal_log', label: 'Submittal Log', description: 'All submittals with review status' },
];

const STORAGE_KEY = (pid: number) => `health-report-sections-${pid}`;

const defaultEnabled = (): SectionId[] => SECTIONS.map(s => s.id);

// ─── Status helpers ────────────────────────────────────────────────────────────

type Status = 'good' | 'warn' | 'bad';
const STATUS_HEX: Record<Status, string> = { good: '#10b981', warn: '#f59e0b', bad: '#ef4444' };
const STATUS_RGB: Record<Status, [number, number, number]> = { good: [16, 185, 129], warn: [245, 158, 11], bad: [239, 68, 68] };

const COST_TYPE_LABELS: Record<number, string> = {
  1: 'Labor', 2: 'Material', 3: 'Subcontracts', 4: 'Rentals', 5: 'MEP Equipment', 6: 'General Conditions',
};

// ─── Component ─────────────────────────────────────────────────────────────────

const ProjectHealthReport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = Number(projectId);
  const { tenant } = useAuth();

  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [enabled, setEnabled] = useState<SectionId[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY(pid));
      if (stored) return JSON.parse(stored) as SectionId[];
    } catch { /* ignore */ }
    return defaultEnabled();
  });
  const [exporting, setExporting] = useState(false);

  // Persist section selection
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY(pid), JSON.stringify(enabled));
  }, [enabled, pid]);

  // Load logo
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

  const toggle = (id: SectionId) =>
    setEnabled(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectAll = () => setEnabled(SECTIONS.map(s => s.id));
  const clearAll = () => setEnabled([]);
  const on = (id: SectionId) => enabled.includes(id);

  // ─── Data queries (all always fetched) ────────────────────────────────────

  const { data: project } = useQuery({ queryKey: ['project', pid], queryFn: () => projectsApi.getById(pid).then(r => r.data), enabled: !!pid });
  const { data: contract } = useQuery({ queryKey: ['vista-contract', pid], queryFn: () => vistaDataService.getContractByProjectId(pid), enabled: !!pid });
  const { data: costSummary } = useQuery({ queryKey: ['phase-cost-summary', pid], queryFn: () => vistaDataService.getPhaseCodeCostSummary(pid), enabled: !!pid });
  const { data: rfis = [] } = useQuery({ queryKey: ['rfis', pid], queryFn: () => rfisApi.getByProject(pid).then(r => r.data), enabled: !!pid });
  const { data: submittals = [] } = useQuery({ queryKey: ['submittals', pid], queryFn: () => submittalsApi.getByProject(pid).then(r => r.data), enabled: !!pid });
  const { data: changeOrders = [] } = useQuery({ queryKey: ['change-orders', pid], queryFn: () => changeOrdersApi.getByProject(pid).then(r => r.data), enabled: !!pid });
  const { data: issues = [] } = useQuery({ queryKey: ['field-issues', pid], queryFn: () => fieldIssuesApi.getByProject(pid).then(r => r.data), enabled: !!pid });
  const { data: gainFadeNotes = [] } = useQuery({ queryKey: ['projectionNotes', pid], queryFn: () => projectionNotesApi.list(pid, { type: 'gain_fade' }).then(r => r.data), enabled: !!pid });
  const { data: segmentsData } = useQuery({ queryKey: ['schedule-segments', pid], queryFn: () => scheduleSegmentsService.getSegments(pid), enabled: !!pid });
  const { data: segCosts = [] } = useQuery({ queryKey: ['schedule-segment-costs', pid], queryFn: () => scheduleSegmentsService.getCosts(pid), enabled: !!pid });

  const segmentMap = useMemo(() => new Map((segmentsData?.segments ?? []).map(s => [s.segment_key, s])), [segmentsData]);
  const costsMap   = useMemo(() => new Map((segCosts as SegmentCosts[]).map(c => [c.segment_key, c])), [segCosts]);
  const activeKeys: string[] = segmentsData?.activeKeys ?? [];

  // ─── Chart infrastructure ──────────────────────────────────────────────────
  const laborChartsRef = useRef<HTMLDivElement>(null);
  const finChartsRef = useRef<HTMLDivElement>(null);
  const laborHoursChartsRef = useRef<HTMLDivElement>(null);

  const shiftSettings = useMemo<ShiftSettings>(() => {
    const parse = (raw: string | null): ShiftSettings | null => {
      if (!raw) return null;
      try {
        const p = JSON.parse(raw);
        if (p && typeof Object.values(p)[0] === 'object' && 'hoursPerDay' in (Object.values(p)[0] as any)) return null;
        return { ...SHIFT_DEFAULTS, ...p };
      } catch { return null; }
    };
    return parse(localStorage.getItem(`costTypeSchedule_shifts_${pid}`))
      ?? parse(localStorage.getItem('costTypeSchedule_shifts'))
      ?? { ...SHIFT_DEFAULTS };
  }, [pid]);

  const allMonths = useMemo<Date[]>(() => {
    const segs = segmentsData?.segments ?? [];
    const starts = segs.map(s => s.start_date ? new Date(s.start_date.slice(0, 10)).getTime() : null).filter(Boolean) as number[];
    const ends   = segs.map(s => s.end_date   ? new Date(s.end_date.slice(0, 10)).getTime()   : null).filter(Boolean) as number[];
    if (!starts.length && !ends.length) return [];
    const tStart = Math.min(...starts), tEnd = Math.max(...ends);
    const months: Date[] = [];
    const cur = new Date(tStart); cur.setDate(1);
    while (cur.getTime() <= tEnd) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
    return months;
  }, [segmentsData]);

  const chartLabels = useMemo(() =>
    allMonths.map(m => m.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })),
    [allMonths]
  );

  const todayIsoH = toIsoH(new Date());
  const clampStartH = (s: string | null | undefined) => s && s.slice(0, 10) < todayIsoH ? todayIsoH : (s?.slice(0, 10) ?? null);

  const laborDatasets = useMemo(() => {
    return SEGMENT_DEFINITIONS
      .filter(d => d.isLabor && activeKeys.includes(d.key))
      .map(def => {
        const seg = segmentMap.get(def.key);
        const c = costsMap.get(def.key);
        const shift = shiftSettings[def.key] ?? SHIFT_DEFAULTS[def.key] ?? DEFAULT_SHIFT;
        const capacity = hrsPerPersonPerMonth(shift);
        const estHrs = safeN(c?.est_hours), jtdHrs = safeN(c?.jtd_hours);
        const remHrs = estHrs > 0 ? Math.max(0, estHrs - jtdHrs) : null;
        const hours = remHrs != null && remHrs > 0
          ? distributeMonthlyH(remHrs, clampStartH(seg?.start_date), seg?.end_date ?? null, seg?.contour_type ?? 'bell', allMonths)
          : allMonths.map(() => 0);
        const data = hours.map(h => capacity > 0 ? Math.round((h / capacity) * 10) / 10 : 0);
        return { label: def.label, data, color: LABOR_CHART_COLORS[def.key] ?? '#6b7280' };
      })
      .filter(ds => ds.data.some(v => v > 0));
  }, [activeKeys, segmentMap, costsMap, shiftSettings, allMonths]);

  const monthlyRevenue = useMemo(() => {
    const totalJtd = (segCosts as SegmentCosts[]).reduce((s, c) => s + safeN(c.jtd_cost), 0);
    const totalRem = (segCosts as SegmentCosts[]).reduce((s, c) => s + (safeN(c.projected_cost) - safeN(c.jtd_cost)), 0);
    const projCostFromSegs = totalJtd + totalRem;
    const projRev = safeN(project?.projected_revenue);
    const revMult = projRev > 0 && projCostFromSegs > 0 ? projRev / projCostFromSegs : 0;
    const monthlyTotalCost = allMonths.map((_, i) =>
      SEGMENT_DEFINITIONS.reduce((sum, def) => {
        if (!activeKeys.includes(def.key)) return sum;
        const seg = segmentMap.get(def.key);
        const c = costsMap.get(def.key);
        const rem = safeN(c?.projected_cost) - safeN(c?.jtd_cost);
        if (rem <= 0) return sum;
        return sum + (distributeMonthlyH(rem, clampStartH(seg?.start_date), seg?.end_date ?? null, seg?.contour_type ?? 'bell', allMonths)[i] ?? 0);
      }, 0)
    );
    return monthlyTotalCost.map(c => c * revMult);
  }, [segCosts, project, activeKeys, segmentMap, costsMap, allMonths]);

  const hasLaborCharts = allMonths.length > 0 && (laborDatasets.length > 0 || monthlyRevenue.some(v => v > 0));

  const finChartData = useMemo(() => {
    if (!contract) return null;
    return {
      categories: ['Labor', 'Material', 'Subcontracts', 'Rentals'],
      estData:  [safeN(costSummary?.labor_totals?.est_cost),       safeN(contract.material_estimate),       safeN(contract.subcontracts_estimate),       safeN(contract.rentals_estimate)],
      projData: [safeN(costSummary?.labor_totals?.projected_cost), safeN(contract.material_projected),      safeN(contract.subcontracts_projected),      safeN(contract.rentals_projected)],
      jtdData:  [safeN(costSummary?.labor_totals?.jtd_cost),       safeN(contract.material_jtd),            safeN(contract.subcontracts_jtd),            safeN(contract.rentals_jtd)],
    };
  }, [contract, costSummary]);

  const laborHoursChartData = useMemo(() => {
    if (!contract) return null;
    return {
      tradeNames: ['Pipefitter', 'Sheet Metal', 'Plumbing'],
      estHrs:  [safeN(contract.pf_hours_estimate), safeN(contract.sm_hours_estimate), safeN(contract.pl_hours_estimate)],
      jtdHrs:  [safeN(contract.pf_hours_jtd),      safeN(contract.sm_hours_jtd),      safeN(contract.pl_hours_jtd)],
      projHrs: [safeN(contract.pf_hours_projected), safeN(contract.sm_hours_projected), safeN(contract.pl_hours_projected)],
    };
  }, [contract]);

  // ─── Derived metrics ───────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const origMargin = contract?.original_estimated_margin ?? 0;
    const curMargin = contract?.gross_profit_dollars ?? 0;
    const gainFade = curMargin - origMargin;
    const laborProjCost = costSummary?.labor_totals?.projected_cost ?? 0;
    const laborEstCost = costSummary?.labor_totals?.est_cost ?? 0;
    const laborVariance = laborEstCost > 0 ? (laborProjCost - laborEstCost) / laborEstCost : 0;
    const openRFIs = rfis.filter(r => r.status !== 'closed').length;
    const overdueRFIs = rfis.filter(r => r.status !== 'closed' && r.due_date && new Date(r.due_date) < new Date()).length;
    const pendingSubmittals = submittals.filter(s => s.status === 'pending' || s.status === 'under_review').length;
    const pendingCOs = changeOrders.filter(c => c.status === 'pending').length;
    const approvedCOAmount = changeOrders.filter(c => c.status === 'approved').reduce((s, c) => s + (c.amount ?? 0), 0);
    const openIssues = issues.filter(i => i.status !== 'closed' && i.status !== 'resolved').length;
    const urgentIssues = issues.filter(i => (i.status !== 'closed' && i.status !== 'resolved') && (i.priority === 'urgent' || i.priority === 'high')).length;
    return { gainFade, origMargin, curMargin, laborVariance, laborProjCost, openRFIs, overdueRFIs, pendingSubmittals, pendingCOs, approvedCOAmount, openIssues, urgentIssues };
  }, [contract, costSummary, rfis, submittals, changeOrders, issues]);

  const marginStatus: Status = metrics.gainFade >= 0 ? 'good' : metrics.gainFade > -50000 ? 'warn' : 'bad';
  const laborStatus: Status = metrics.laborVariance <= 0.02 ? 'good' : metrics.laborVariance <= 0.08 ? 'warn' : 'bad';
  const rfiStatus: Status = metrics.overdueRFIs === 0 ? (metrics.openRFIs < 5 ? 'good' : 'warn') : 'bad';
  const submittalStatus: Status = metrics.pendingSubmittals === 0 ? 'good' : metrics.pendingSubmittals < 5 ? 'warn' : 'bad';
  const issueStatus: Status = metrics.urgentIssues === 0 ? (metrics.openIssues === 0 ? 'good' : 'warn') : 'bad';
  const coStatus: Status = metrics.pendingCOs === 0 ? 'good' : metrics.pendingCOs < 3 ? 'warn' : 'bad';

  const trades = useMemo(() => {
    if (!contract) return [];
    return [
      { label: 'Pipefitter', estHrs: contract.pf_hours_estimate, jtdHrs: contract.pf_hours_jtd, projHrs: contract.pf_hours_projected, estCost: costSummary?.labor?.find(l => l.trade === 'pf')?.est_cost ?? null, jtdCost: costSummary?.labor?.find(l => l.trade === 'pf')?.jtd_cost ?? null, projCost: costSummary?.labor?.find(l => l.trade === 'pf')?.projected_cost ?? null },
      { label: 'Sheet Metal', estHrs: contract.sm_hours_estimate, jtdHrs: contract.sm_hours_jtd, projHrs: contract.sm_hours_projected, estCost: costSummary?.labor?.find(l => l.trade === 'sm')?.est_cost ?? null, jtdCost: costSummary?.labor?.find(l => l.trade === 'sm')?.jtd_cost ?? null, projCost: costSummary?.labor?.find(l => l.trade === 'sm')?.projected_cost ?? null },
      { label: 'Plumbing', estHrs: contract.pl_hours_estimate, jtdHrs: contract.pl_hours_jtd, projHrs: contract.pl_hours_projected, estCost: costSummary?.labor?.find(l => l.trade === 'pl')?.est_cost ?? null, jtdCost: costSummary?.labor?.find(l => l.trade === 'pl')?.jtd_cost ?? null, projCost: costSummary?.labor?.find(l => l.trade === 'pl')?.projected_cost ?? null },
      { label: 'Total', estHrs: contract.total_hours_estimate, jtdHrs: contract.total_hours_jtd, projHrs: contract.total_hours_projected, estCost: costSummary?.labor_totals?.est_cost ?? null, jtdCost: costSummary?.labor_totals?.jtd_cost ?? null, projCost: costSummary?.labor_totals?.projected_cost ?? null, isTotal: true },
    ];
  }, [contract, costSummary]);

  // ─── PDF Export ────────────────────────────────────────────────────────────

  const handleExportPdf = async () => {
    if (enabled.length === 0) return;
    setExporting(true);

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const ORANGE: [number, number, number] = [249, 115, 22];
      const NAVY: [number, number, number] = [15, 23, 42];
      const SLATE: [number, number, number] = [100, 116, 139];
      const LIGHT: [number, number, number] = [241, 245, 249];

      const accentBar = () => {
        doc.setFillColor(...ORANGE);
        doc.rect(0, 0, pw, 4, 'F');
      };
      const footer = () => {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...SLATE);
        doc.text(`Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, 40, ph - 18);
        const p = (doc as any).internal.getCurrentPageInfo().pageNumber;
        const t = (doc as any).internal.getNumberOfPages();
        doc.text(`Page ${p} of ${t}`, pw - 40, ph - 18, { align: 'right' });
      };
      const sectionHeader = (label: string, y: number): number => {
        doc.setFillColor(...NAVY);
        doc.rect(40, y, pw - 80, 18, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(label.toUpperCase(), 48, y + 12);
        return y + 26;
      };

      // ── Cover page ──────────────────────────────────────────────────────────
      accentBar();
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, 'PNG', pw - 170, 12, 130, 36); } catch { /* skip */ }
      }

      let y = 55;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...SLATE);
      doc.text(project?.name ?? '', 40, y);
      if (project?.number) { doc.text(`#${project.number}`, pw - 40, y, { align: 'right' }); }
      y += 18;
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text('Project Health Report', 40, y);
      y += 10;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...SLATE);
      doc.text(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 40, y + 10);
      y += 30;

      // Section list on cover
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text('Included Sections:', 40, y);
      y += 12;
      const includedSections = SECTIONS.filter(s => enabled.includes(s.id));
      includedSections.forEach(s => {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...SLATE);
        doc.text(`• ${s.label}`, 50, y);
        y += 12;
      });

      // ── Health Summary ───────────────────────────────────────────────────────
      if (on('health_summary')) {
        doc.addPage();
        accentBar();
        y = sectionHeader('Project Health Summary', 18);
        y += 4;

        const cardData = [
          { title: 'Margin / Gain-Fade', value: fmt(metrics.curMargin), sub: `${metrics.gainFade >= 0 ? '+' : ''}${fmt(metrics.gainFade)} vs estimate`, status: marginStatus },
          { title: 'Labor Cost', value: fmt(metrics.laborProjCost), sub: `${metrics.laborVariance >= 0 ? '+' : ''}${(metrics.laborVariance * 100).toFixed(1)}% vs estimate`, status: laborStatus },
          { title: 'Open RFIs', value: String(metrics.openRFIs), sub: metrics.overdueRFIs > 0 ? `${metrics.overdueRFIs} overdue` : 'None overdue', status: rfiStatus },
          { title: 'Submittals Pending', value: String(metrics.pendingSubmittals), sub: `${submittals.length} total`, status: submittalStatus },
          { title: 'Field Issues Open', value: String(metrics.openIssues), sub: metrics.urgentIssues > 0 ? `${metrics.urgentIssues} high/urgent` : 'No urgent items', status: issueStatus },
          { title: 'Change Orders Pending', value: String(metrics.pendingCOs), sub: `${fmt(metrics.approvedCOAmount)} approved`, status: coStatus },
        ];

        const cols = 3;
        const cardW = (pw - 80 - (cols - 1) * 8) / cols;
        const cardH = 55;
        cardData.forEach((card, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cx = 40 + col * (cardW + 8);
          const cy = y + row * (cardH + 8);
          const rgb = STATUS_RGB[card.status];
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'F');
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.rect(cx, cy, cardW, 3, 'F');
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...SLATE);
          doc.text(card.title.toUpperCase(), cx + 8, cy + 13);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...NAVY);
          doc.text(card.value, cx + 8, cy + 29);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...SLATE);
          doc.text(card.sub, cx + 8, cy + 41);
          doc.setFillColor(rgb[0], rgb[1], rgb[2]);
          doc.circle(cx + cardW - 10, cy + 13, 3, 'F');
        });
        y += Math.ceil(cardData.length / cols) * (cardH + 8) + 8;
        footer();
      }

      // ── Financial Summary ────────────────────────────────────────────────────
      if (on('financial_summary') && contract) {
        doc.addPage();
        accentBar();
        y = sectionHeader('Financial Summary', 18);

        if (finChartsRef.current && finChartData) {
          try {
            const canvas = await html2canvas(finChartsRef.current, { scale: 1.5, backgroundColor: '#ffffff', useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const availW = pw - 80;
            const naturalH = (canvas.height / canvas.width) * availW;
            const fitH = Math.min(naturalH, 155);
            const fitW = (fitH / naturalH) * availW;
            doc.addImage(imgData, 'PNG', 40, y, fitW, fitH);
            y += fitH + 10;
          } catch {}
        }

        const finRows = [
          ['Contract Value', fmt(contract.orig_contract_amount), fmt(contract.projected_revenue), fmt(contract.billed_amount), ''],
          ['Total Cost', fmt(contract.current_est_cost), fmt(contract.projected_cost), fmt(contract.actual_cost), ''],
          ['  Labor', fmt(costSummary?.labor_totals?.est_cost), fmt(costSummary?.labor_totals?.projected_cost), fmt(costSummary?.labor_totals?.jtd_cost), ''],
          ['  Material', fmt(contract.material_estimate), fmt(contract.material_projected), fmt(contract.material_jtd), ''],
          ['  Subcontracts', fmt(contract.subcontracts_estimate), fmt(contract.subcontracts_projected), fmt(contract.subcontracts_jtd), ''],
          ['  Rentals', fmt(contract.rentals_estimate), fmt(contract.rentals_projected), fmt(contract.rentals_jtd), ''],
          ['Gross Profit', fmt(contract.original_estimated_margin), fmt(contract.gross_profit_dollars), '—', ''],
        ].map(row => {
          const est = row[1] === '—' ? null : parseFloat(row[1].replace(/[$,]/g, ''));
          const proj = row[2] === '—' ? null : parseFloat(row[2].replace(/[$,]/g, ''));
          const variance = est != null && proj != null ? proj - est : null;
          const isGP = row[0] === 'Gross Profit';
          row[4] = variance != null ? `${variance >= 0 ? '+' : ''}${fmt(variance)}` : '—';
          return row;
        });
        autoTable(doc, {
          startY: y,
          head: [['Item', 'Estimate', 'Projected', 'JTD Actual', 'Variance']],
          body: finRows,
          margin: { left: 40, right: 40 },
          styles: { fontSize: 8, cellPadding: 5, textColor: [30, 41, 59] },
          headStyles: { fillColor: [30, 42, 60], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 4) {
              const v = String(data.cell.raw ?? '');
              const rowLabel = String(finRows[data.row.index]?.[0] ?? '');
              const isGP = rowLabel === 'Gross Profit';
              if (v.startsWith('+')) data.cell.styles.textColor = isGP ? [16, 185, 129] : [239, 68, 68];
              else if (v.startsWith('(')) data.cell.styles.textColor = isGP ? [239, 68, 68] : [16, 185, 129];
            }
          },
          didDrawPage: () => { accentBar(); footer(); },
        });
      }

      // ── Labor Hours ──────────────────────────────────────────────────────────
      if (on('labor_hours') && contract) {
        doc.addPage();
        accentBar();
        y = sectionHeader('Labor Hours', 18);

        if (laborHoursChartsRef.current && laborHoursChartData) {
          try {
            const canvas = await html2canvas(laborHoursChartsRef.current, { scale: 1.5, backgroundColor: '#ffffff', useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const availW = pw - 80;
            const naturalH = (canvas.height / canvas.width) * availW;
            const fitH = Math.min(naturalH, 155);
            const fitW = (fitH / naturalH) * availW;
            doc.addImage(imgData, 'PNG', 40, y, fitW, fitH);
            y += fitH + 10;
          } catch {}
        }

        autoTable(doc, {
          startY: y,
          head: [['Trade', 'Est Hours', 'JTD Hours', 'Proj Hours', 'Remaining']],
          body: [
            ['Pipefitter', fmtN(contract.pf_hours_estimate), fmtN(contract.pf_hours_jtd), fmtN(contract.pf_hours_projected), fmtN((contract.pf_hours_projected ?? 0) - (contract.pf_hours_jtd ?? 0))],
            ['Sheet Metal', fmtN(contract.sm_hours_estimate), fmtN(contract.sm_hours_jtd), fmtN(contract.sm_hours_projected), fmtN((contract.sm_hours_projected ?? 0) - (contract.sm_hours_jtd ?? 0))],
            ['Plumbing', fmtN(contract.pl_hours_estimate), fmtN(contract.pl_hours_jtd), fmtN(contract.pl_hours_projected), fmtN((contract.pl_hours_projected ?? 0) - (contract.pl_hours_jtd ?? 0))],
            ['Total', fmtN(contract.total_hours_estimate), fmtN(contract.total_hours_jtd), fmtN(contract.total_hours_projected), fmtN((contract.total_hours_projected ?? 0) - (contract.total_hours_jtd ?? 0))],
          ],
          margin: { left: 40, right: 40 },
          styles: { fontSize: 8, cellPadding: 5, textColor: [30, 41, 59] },
          headStyles: { fillColor: [30, 42, 60], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
          didDrawPage: () => { accentBar(); footer(); },
        });
      }

      // ── Labor Forecast ────────────────────────────────────────────────────────
      if (on('labor_forecast') && (trades.length > 0 || activeKeys.length > 0)) {
        doc.addPage();
        accentBar();
        y = sectionHeader('Labor Forecast', 18);

        // Capture shift schedule + charts from hidden DOM element
        if (laborChartsRef.current && hasLaborCharts) {
          try {
            const canvas = await html2canvas(laborChartsRef.current, { scale: 1.5, backgroundColor: '#ffffff', useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const availW = pw;
            const naturalH = (canvas.height / canvas.width) * availW;
            const fitH = Math.min(naturalH, 170);
            const fitW = (fitH / naturalH) * availW;
            doc.addImage(imgData, 'PNG', 40, y, fitW, fitH);
            y += fitH + 10;
          } catch {}
        }

        // Cost Type Schedule table
        if (activeKeys.length > 0) {
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...SLATE);
          doc.text('Cost Type Schedule', 40, y + 6);
          y += 14;
          type SegRow = string[];
          const segRows: SegRow[] = [];
          let lastGrp = '';
          SEGMENT_DEFINITIONS.forEach(def => {
            if (!activeKeys.includes(def.key)) return;
            const grp = def.isLabor ? 'LABOR' : 'NON-LABOR';
            if (grp !== lastGrp) { segRows.push([grp, '', '', '', '', '', '']); lastGrp = grp; }
            const seg = segmentMap.get(def.key);
            const c = costsMap.get(def.key);
            const remHrs = def.isLabor ? calcRemHrsHealth(c) : null;
            const remCost = safeN(c?.projected_cost) - safeN(c?.jtd_cost);
            const rate = def.isLabor ? calcRateHealth(c) : null;
            segRows.push([
              def.label,
              def.isLabor && remHrs != null ? fmtHrs(remHrs) : '—',
              remCost > 0 ? fmtCompact(remCost) : '—',
              rate != null ? `$${Math.round(rate)}` : '—',
              fmtDateShort(seg?.start_date), fmtDateShort(seg?.end_date),
              calcDurLabel(seg?.start_date ?? null, seg?.end_date ?? null),
            ]);
          });
          autoTable(doc, {
            startY: y,
            head: [['Cost Type', 'Rem Hrs', 'Rem $', 'Est $/hr', 'Start', 'End', 'Dur']],
            body: segRows,
            margin: { left: 40, right: 40 },
            styles: { fontSize: 7, cellPadding: 2.5, textColor: [30, 41, 59] },
            headStyles: { fillColor: [30, 42, 60], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
            columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
            didParseCell: (data: any) => {
              const row = segRows[data.row.index];
              if (row && (row[0] === 'LABOR' || row[0] === 'NON-LABOR') && data.section === 'body') {
                data.cell.styles.fillColor = [238, 242, 247];
                data.cell.styles.fontStyle = 'bold';
              }
            },
            didDrawPage: () => { accentBar(); footer(); },
          });
          y = (doc as any).lastAutoTable.finalY + 14;
        }

        // Vista trade hours table
        if (trades.length > 0) {
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...SLATE);
          doc.text('Labor Hours by Trade (Vista)', 40, y + 6);
          y += 14;
          autoTable(doc, {
            startY: y,
            head: [['Trade', 'Est Hrs', 'JTD Hrs', 'Proj Hrs', 'Est Cost', 'JTD Cost', 'Proj Cost', 'Variance $', 'Var %']],
            body: trades.map(t => {
              const variance = (t.projCost ?? 0) - (t.estCost ?? 0);
              const pct = t.estCost && t.estCost !== 0 ? `${((variance / t.estCost) * 100).toFixed(1)}%` : '—';
              return [t.label, fmtN(t.estHrs), fmtN(t.jtdHrs), fmtN(t.projHrs), fmt(t.estCost), fmt(t.jtdCost), fmt(t.projCost), `${variance >= 0 ? '+' : ''}${fmt(variance)}`, pct];
            }),
            margin: { left: 40, right: 40 },
            styles: { fontSize: 7, cellPadding: 2.5, textColor: [30, 41, 59] },
            headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
              0: { halign: 'left',  cellWidth: 70 },
              1: { halign: 'right', cellWidth: 55 },
              2: { halign: 'right', cellWidth: 55 },
              3: { halign: 'right', cellWidth: 55 },
              4: { halign: 'right', cellWidth: 70 },
              5: { halign: 'right', cellWidth: 70 },
              6: { halign: 'right', cellWidth: 70 },
              7: { halign: 'right', cellWidth: 70 },
              8: { halign: 'right', cellWidth: 42 },
            },
            didParseCell: (data: any) => {
              if (data.section === 'body' && (data.column.index === 7 || data.column.index === 8)) {
                const v = String(data.cell.raw ?? '');
                if (v.startsWith('+')) data.cell.styles.textColor = [239, 68, 68];
                else if (v.startsWith('(')) data.cell.styles.textColor = [16, 185, 129];
              }
            },
            didDrawPage: () => { accentBar(); footer(); },
          });
        }
      }

      // ── Gain / Fade ──────────────────────────────────────────────────────────
      if (on('gain_fade')) {
        doc.addPage();
        accentBar();
        y = sectionHeader('Gain / Fade', 18);
        const gfTotals = gainFadeNotes.reduce((acc, n) => {
          const v = typeof n.amount === 'string' ? parseFloat(n.amount) : (n.amount ?? 0);
          const safe = isNaN(v) ? 0 : v;
          return { ...acc, net: acc.net + safe, gain: acc.gain + (safe > 0 ? safe : 0), fade: acc.fade + (safe < 0 ? safe : 0) };
        }, { net: 0, gain: 0, fade: 0 });

        // Summary strip
        const stripItems = [
          { label: 'Items', value: String(gainFadeNotes.length) },
          { label: 'Total Gains', value: fmt(gfTotals.gain) },
          { label: 'Total Fades', value: fmt(Math.abs(gfTotals.fade)) },
          { label: 'Net', value: fmtSigned(gfTotals.net) },
        ];
        const stripW = pw - 80;
        const cellW = stripW / stripItems.length;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(40, y, stripW, 30, 3, 3, 'F');
        stripItems.forEach((item, i) => {
          const cx = 40 + i * cellW + cellW / 2;
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...SLATE);
          doc.text(item.label.toUpperCase(), cx, y + 9, { align: 'center' });
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...NAVY);
          doc.text(item.value, cx, y + 22, { align: 'center' });
        });
        y += 38;

        if (gainFadeNotes.length > 0) {
          autoTable(doc, {
            startY: y,
            head: [['Date', 'Description', 'Reasoning', 'Cost Type', 'Amount', 'Recognized', 'Entered By']],
            body: gainFadeNotes.map(n => {
              const v = typeof n.amount === 'string' ? parseFloat(n.amount) : (n.amount ?? 0);
              return [
                fmtDate(n.snapshot_date ?? n.created_at),
                n.body,
                n.reasoning ?? '',
                n.cost_type == null ? 'Contract-wide' : (COST_TYPE_LABELS[n.cost_type] ?? `Type ${n.cost_type}`),
                fmtSigned(n.amount),
                n.recognized_in_financials ? 'Yes' : 'No',
                n.created_by_name,
              ];
            }),
            margin: { left: 40, right: 40 },
            styles: { fontSize: 7.5, cellPadding: 4, textColor: [30, 41, 59] },
            headStyles: { fillColor: LIGHT, textColor: SLATE, fontStyle: 'bold', fontSize: 7 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 0: { halign: 'left', cellWidth: 55 }, 1: { halign: 'left' }, 2: { halign: 'left' }, 3: { halign: 'left', cellWidth: 70 }, 4: { halign: 'right', cellWidth: 65 }, 5: { halign: 'center', cellWidth: 50 }, 6: { halign: 'left', cellWidth: 65 } },
            didParseCell: (data: any) => {
              if (data.section === 'body' && data.column.index === 4) {
                const v = String(data.cell.raw ?? '');
                if (v.startsWith('+')) data.cell.styles.textColor = [16, 185, 129];
                else if (v.startsWith('(')) data.cell.styles.textColor = [239, 68, 68];
              }
            },
            didDrawPage: () => { accentBar(); footer(); },
          });
        } else {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(...SLATE);
          doc.text('No gain/fade items have been logged for this project.', 40, y + 10);
        }
      }

      // ── Document Status ──────────────────────────────────────────────────────
      if (on('document_status')) {
        const prevFinalY = (doc as any).lastAutoTable?.finalY;
        const needsNewPage = !prevFinalY || prevFinalY > ph - 100;
        if (needsNewPage) { doc.addPage(); accentBar(); y = 18; }
        else y = prevFinalY + 16;
        y = sectionHeader('Document Status', y);
        const docStats = [
          { label: 'Open RFIs', value: `${rfis.filter(r => r.status !== 'closed').length} / ${rfis.length}` },
          { label: 'Pending Submittals', value: `${submittals.filter(s => s.status !== 'approved' && s.status !== 'rejected').length} / ${submittals.length}` },
          { label: 'Open Change Orders', value: `${changeOrders.filter(c => c.status !== 'approved' && c.status !== 'rejected').length} / ${changeOrders.length}` },
          { label: 'Open Issues', value: `${issues.filter(i => i.status !== 'closed' && i.status !== 'resolved').length} / ${issues.length}` },
        ];
        const stripW2 = pw - 80;
        const cw2 = stripW2 / docStats.length;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(40, y, stripW2, 36, 3, 3, 'F');
        docStats.forEach((item, i) => {
          const cx = 40 + i * cw2 + cw2 / 2;
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...SLATE);
          doc.text(item.label.toUpperCase(), cx, y + 10, { align: 'center' });
          doc.setFontSize(13);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...NAVY);
          doc.text(item.value, cx, y + 26, { align: 'center' });
        });
        footer();
      }

      // ── Issues Log ───────────────────────────────────────────────────────────
      if (on('issues_log') && issues.length > 0) {
        doc.addPage();
        accentBar();
        y = sectionHeader('Issues Log', 18);
        autoTable(doc, {
          startY: y,
          head: [['#', 'Title', 'Priority', 'Trade', 'Status', 'Source', 'Created By', 'Date']],
          body: issues.map(i => [String(i.number), i.title, i.priority, i.trade ?? '—', i.status, i.source, i.created_by_name, fmtDate(i.created_at)]),
          margin: { left: 40, right: 40 },
          styles: { fontSize: 7.5, cellPadding: 4, textColor: [30, 41, 59] },
          headStyles: { fillColor: LIGHT, textColor: SLATE, fontStyle: 'bold', fontSize: 7 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 1: { halign: 'left' }, 2: { halign: 'center', cellWidth: 50 }, 3: { halign: 'left', cellWidth: 55 }, 4: { halign: 'center', cellWidth: 55 }, 5: { halign: 'left', cellWidth: 45 }, 6: { halign: 'left', cellWidth: 70 }, 7: { halign: 'center', cellWidth: 60 } },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 2) {
              const p = String(data.cell.raw ?? '').toLowerCase();
              const colors: Record<string, [number, number, number]> = { urgent: [239, 68, 68], high: [249, 115, 22], normal: [59, 130, 246], low: [148, 163, 184] };
              if (colors[p]) data.cell.styles.textColor = colors[p];
            }
          },
          didDrawPage: () => { accentBar(); footer(); },
        });
      }

      // ── Change Order Log ─────────────────────────────────────────────────────
      if (on('change_order_log') && changeOrders.length > 0) {
        doc.addPage();
        accentBar();
        y = sectionHeader('Change Order Log', 18);
        autoTable(doc, {
          startY: y,
          head: [['#', 'Title', 'Reason', 'Amount', 'Days Added', 'Status', 'Created By', 'Date']],
          body: changeOrders.map(c => [String(c.number), c.title, c.reason ?? '—', fmt(c.amount), String(c.days_added ?? 0), c.status, c.created_by_name, fmtDate(c.created_at)]),
          margin: { left: 40, right: 40 },
          styles: { fontSize: 7.5, cellPadding: 4, textColor: [30, 41, 59] },
          headStyles: { fillColor: LIGHT, textColor: SLATE, fontStyle: 'bold', fontSize: 7 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 1: { halign: 'left' }, 2: { halign: 'left' }, 3: { halign: 'right', cellWidth: 65 }, 4: { halign: 'center', cellWidth: 45 }, 5: { halign: 'center', cellWidth: 55 }, 6: { halign: 'left', cellWidth: 70 }, 7: { halign: 'center', cellWidth: 60 } },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 5) {
              const s = String(data.cell.raw ?? '').toLowerCase();
              const colors: Record<string, [number, number, number]> = { approved: [16, 185, 129], pending: [245, 158, 11], rejected: [239, 68, 68], draft: [148, 163, 184] };
              if (colors[s]) data.cell.styles.textColor = colors[s];
            }
          },
          didDrawPage: () => { accentBar(); footer(); },
        });
      }

      // ── RFI Log ──────────────────────────────────────────────────────────────
      if (on('rfi_log') && rfis.length > 0) {
        doc.addPage();
        accentBar();
        y = sectionHeader('RFI Log', 18);
        autoTable(doc, {
          startY: y,
          head: [['#', 'Subject', 'Priority', 'Status', 'Due Date', 'Ball in Court', 'Responded By', 'Date']],
          body: rfis.map(r => [String(r.number), r.subject, r.priority, r.status, fmtDate(r.due_date), r.ball_in_court_name ?? '—', r.responded_by_name ?? '—', fmtDate(r.created_at)]),
          margin: { left: 40, right: 40 },
          styles: { fontSize: 7.5, cellPadding: 4, textColor: [30, 41, 59] },
          headStyles: { fillColor: LIGHT, textColor: SLATE, fontStyle: 'bold', fontSize: 7 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 1: { halign: 'left' }, 2: { halign: 'center', cellWidth: 50 }, 3: { halign: 'center', cellWidth: 55 }, 4: { halign: 'center', cellWidth: 60 }, 5: { halign: 'left', cellWidth: 75 }, 6: { halign: 'left', cellWidth: 75 }, 7: { halign: 'center', cellWidth: 60 } },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 4) {
              const v = String(data.cell.raw ?? '');
              if (v !== '—' && rfis[data.row.index]?.status !== 'closed' && new Date(rfis[data.row.index]?.due_date ?? '') < new Date()) {
                data.cell.styles.textColor = [239, 68, 68];
              }
            }
          },
          didDrawPage: () => { accentBar(); footer(); },
        });
      }

      // ── Submittal Log ────────────────────────────────────────────────────────
      if (on('submittal_log') && submittals.length > 0) {
        doc.addPage();
        accentBar();
        y = sectionHeader('Submittal Log', 18);
        autoTable(doc, {
          startY: y,
          head: [['#', 'Spec Section', 'Description', 'Subcontractor', 'Status', 'Due Date', 'Reviewed By', 'Date']],
          body: submittals.map(s => [String(s.number), s.spec_section, s.description, s.subcontractor, s.status, fmtDate(s.due_date), s.reviewed_by ? (s.reviewed_at ? fmtDate(s.reviewed_at) : 'Yes') : '—', fmtDate(s.created_at)]),
          margin: { left: 40, right: 40 },
          styles: { fontSize: 7.5, cellPadding: 4, textColor: [30, 41, 59] },
          headStyles: { fillColor: LIGHT, textColor: SLATE, fontStyle: 'bold', fontSize: 7 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 0: { halign: 'center', cellWidth: 25 }, 1: { halign: 'left', cellWidth: 70 }, 2: { halign: 'left' }, 3: { halign: 'left', cellWidth: 80 }, 4: { halign: 'center', cellWidth: 65 }, 5: { halign: 'center', cellWidth: 60 }, 6: { halign: 'left', cellWidth: 70 }, 7: { halign: 'center', cellWidth: 60 } },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 4) {
              const s = String(data.cell.raw ?? '').toLowerCase();
              const colors: Record<string, [number, number, number]> = { approved: [16, 185, 129], rejected: [239, 68, 68], under_review: [59, 130, 246], pending: [245, 158, 11] };
              if (colors[s]) data.cell.styles.textColor = colors[s];
            }
          },
          didDrawPage: () => { accentBar(); footer(); },
        });
      }

      // Update page footers with correct total
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...SLATE);
        doc.text(`Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, 40, ph - 18);
        doc.text(`Page ${i} of ${totalPages}`, pw - 40, ph - 18, { align: 'right' });
      }

      doc.save(`ProjectHealthReport_${project?.number ?? pid}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  // ─── UI ────────────────────────────────────────────────────────────────────

  const btnStyle: React.CSSProperties = {
    padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 6,
    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, background: '#fff', color: '#475569',
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1140 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 4 }}>{project?.name ?? ''}</div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Project Health Report</h1>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 4 }}>Select sections to include in the exported PDF</div>
        </div>
        <button
          onClick={handleExportPdf}
          disabled={exporting || enabled.length === 0}
          style={{ padding: '9px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, cursor: (exporting || enabled.length === 0) ? 'default' : 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: (exporting || enabled.length === 0) ? 0.5 : 1 }}
        >
          {exporting ? 'Generating…' : `Export PDF (${enabled.length} sections)`}
        </button>
      </div>

      {/* Section selector */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>Report Sections</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={selectAll} style={btnStyle}>Include All</button>
            <button onClick={clearAll} style={btnStyle}>Clear All</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem' }}>
          {SECTIONS.map(s => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.625rem 0.75rem', border: `1px solid ${on(s.id) ? '#3b82f6' : '#e2e8f0'}`, borderRadius: 8, cursor: 'pointer', background: on(s.id) ? '#eff6ff' : '#f8fafc', transition: 'all 0.1s' }}>
              <input type="checkbox" checked={on(s.id)} onChange={() => toggle(s.id)} style={{ marginTop: 2, accentColor: '#3b82f6', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.825rem', fontWeight: 600, color: on(s.id) ? '#1d4ed8' : '#374151' }}>{s.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 1 }}>{s.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Live dashboard — status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { title: 'Margin / Gain-Fade', status: marginStatus, primary: fmt(metrics.curMargin), primaryLabel: 'Current Gross Profit', secondary: `${metrics.gainFade >= 0 ? '+' : ''}${fmt(metrics.gainFade)} vs original estimate`, link: 'gain-fade', linkLabel: 'View Gain/Fade' },
          { title: 'Labor Cost', status: laborStatus, primary: fmt(metrics.laborProjCost), primaryLabel: 'Projected Labor Cost', secondary: `${metrics.laborVariance >= 0 ? '+' : ''}${(metrics.laborVariance * 100).toFixed(1)}% vs estimate`, link: 'labor-forecast', linkLabel: 'View Labor Forecast' },
          { title: 'RFIs', status: rfiStatus, primary: String(metrics.openRFIs), primaryLabel: 'Open RFIs', secondary: metrics.overdueRFIs > 0 ? `${metrics.overdueRFIs} overdue` : 'None overdue', link: 'rfis', linkLabel: 'View RFI Log' },
          { title: 'Submittals', status: submittalStatus, primary: String(metrics.pendingSubmittals), primaryLabel: 'Pending Review', secondary: `${submittals.length} total submittals`, link: 'submittals', linkLabel: 'View Submittal Log' },
          { title: 'Field Issues', status: issueStatus, primary: String(metrics.openIssues), primaryLabel: 'Open Issues', secondary: metrics.urgentIssues > 0 ? `${metrics.urgentIssues} high/urgent` : 'No urgent items', link: 'issues-log', linkLabel: 'View Issues Log' },
          { title: 'Change Orders', status: coStatus, primary: String(metrics.pendingCOs), primaryLabel: 'Pending Approval', secondary: `${fmt(metrics.approvedCOAmount)} approved to date`, link: 'change-orders', linkLabel: 'View CO Log' },
        ].map(card => (
          <div key={card.title} style={{ background: '#fff', border: '1px solid #e2e8f0', borderTop: `3px solid ${STATUS_HEX[card.status]}`, borderRadius: 10, padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: STATUS_HEX[card.status], marginRight: 6, flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.title}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{card.primary}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>{card.primaryLabel}</div>
            <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 12 }}>{card.secondary}</div>
            <Link to={`/projects/${projectId}/reports/${card.link}`} style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>{card.linkLabel} →</Link>
          </div>
        ))}
      </div>

      {/* Financial summary */}
      {contract && (
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: '2rem' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>Financial Summary</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Item', 'Estimate', 'Projected', 'JTD Actual', 'Variance'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Item' ? 'left' : 'right', color: '#64748b', fontWeight: 600, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Contract Value', est: contract.orig_contract_amount, proj: contract.projected_revenue, jtd: contract.billed_amount },
                  { label: 'Total Cost', est: contract.current_est_cost, proj: contract.projected_cost, jtd: contract.actual_cost },
                  { label: 'Labor', est: costSummary?.labor_totals?.est_cost, proj: costSummary?.labor_totals?.projected_cost, jtd: costSummary?.labor_totals?.jtd_cost },
                  { label: 'Material', est: contract.material_estimate, proj: contract.material_projected, jtd: contract.material_jtd },
                  { label: 'Subcontracts', est: contract.subcontracts_estimate, proj: contract.subcontracts_projected, jtd: contract.subcontracts_jtd },
                  { label: 'Rentals', est: contract.rentals_estimate, proj: contract.rentals_projected, jtd: contract.rentals_jtd },
                  { label: 'Gross Profit', est: contract.original_estimated_margin, proj: contract.gross_profit_dollars, jtd: null },
                ].map(row => {
                  const variance = (row.proj ?? 0) - (row.est ?? 0);
                  const isGP = row.label === 'Gross Profit';
                  const varColor = variance === 0 ? '#64748b' : (isGP ? (variance > 0 ? '#10b981' : '#ef4444') : (variance < 0 ? '#10b981' : '#ef4444'));
                  return (
                    <tr key={row.label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 14px', color: '#1e293b', fontWeight: isGP || row.label === 'Total Cost' ? 600 : 400 }}>{row.label}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#475569' }}>{fmt(row.est)}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#1e293b', fontWeight: 500 }}>{fmt(row.proj)}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: '#475569' }}>{row.jtd != null ? fmt(row.jtd) : '—'}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'right', color: varColor, fontWeight: 500 }}>
                        {row.est != null && row.proj != null ? `${variance >= 0 ? '+' : ''}${fmt(variance)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Document status */}
      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>Document Status</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 0 }}>
          {[
            { label: 'RFIs', open: rfis.filter(r => r.status !== 'closed').length, total: rfis.length, path: 'rfis' },
            { label: 'Submittals', open: submittals.filter(s => s.status !== 'approved' && s.status !== 'rejected').length, total: submittals.length, path: 'submittals' },
            { label: 'Change Orders', open: changeOrders.filter(c => c.status !== 'approved' && c.status !== 'rejected').length, total: changeOrders.length, path: 'change-orders' },
            { label: 'Field Issues', open: issues.filter(i => i.status !== 'closed' && i.status !== 'resolved').length, total: issues.length, path: 'issues-log' },
          ].map((item, idx) => (
            <div key={item.label} style={{ padding: '1rem 1.25rem', borderRight: idx < 3 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginBottom: 4 }}>{item.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{item.open}</span>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>/ {item.total} total</span>
              </div>
              <Link to={`/projects/${projectId}/reports/${item.path}`} style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none' }}>View log →</Link>
            </div>
          ))}
        </div>
      </section>

      {/* Hidden financial summary chart for PDF capture */}
      {finChartData && (
        <div ref={finChartsRef} style={{ position: 'fixed', left: -9999, top: 0, width: 700, background: '#fff', padding: '8px 12px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cost by Category — Estimate vs Projected vs JTD</div>
          <div style={{ height: 200, position: 'relative' }}>
            <Bar
              data={{ labels: finChartData.categories, datasets: [
                { label: 'Estimate',   data: finChartData.estData,  backgroundColor: '#3b82f6cc', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 2 },
                { label: 'Projected',  data: finChartData.projData, backgroundColor: '#10b981cc', borderColor: '#10b981', borderWidth: 1, borderRadius: 2 },
                { label: 'JTD Actual', data: finChartData.jtdData,  backgroundColor: '#f59e0bcc', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 2 },
              ]}}
              options={{ maintainAspectRatio: false, responsive: true,
                plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 }, padding: 8 } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtCompact(ctx.parsed.y)}` } } },
                scales: { x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, color: '#64748b' } }, y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 10 }, color: '#64748b', callback: v => fmtCompact(v as number) } } }
              }}
            />
          </div>
        </div>
      )}

      {/* Hidden labor hours chart for PDF capture */}
      {laborHoursChartData && (
        <div ref={laborHoursChartsRef} style={{ position: 'fixed', left: -9999, top: 0, width: 600, background: '#fff', padding: '8px 12px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Hours by Trade — Estimate vs JTD vs Projected</div>
          <div style={{ height: 200, position: 'relative' }}>
            <Bar
              data={{ labels: laborHoursChartData.tradeNames, datasets: [
                { label: 'Est Hours',  data: laborHoursChartData.estHrs,  backgroundColor: '#3b82f6cc', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 2 },
                { label: 'JTD Hours',  data: laborHoursChartData.jtdHrs,  backgroundColor: '#f59e0bcc', borderColor: '#f59e0b', borderWidth: 1, borderRadius: 2 },
                { label: 'Proj Hours', data: laborHoursChartData.projHrs, backgroundColor: '#10b981cc', borderColor: '#10b981', borderWidth: 1, borderRadius: 2 },
              ]}}
              options={{ maintainAspectRatio: false, responsive: true,
                plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 }, padding: 8 } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y).toLocaleString()}` } } },
                scales: { x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, color: '#64748b' } }, y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 10 }, color: '#64748b', callback: v => Math.round(v as number).toLocaleString() } } }
              }}
            />
          </div>
        </div>
      )}

      {/* Hidden labor charts — identical markup to Labor Forecast report for consistent PDF capture */}
      {hasLaborCharts && (
        <div ref={laborChartsRef} style={{ position: 'fixed', left: -9999, top: 0, width: 1100, background: '#fff', display: 'flex', gap: '0.875rem', alignItems: 'flex-start', padding: 8 }}>
          {/* Shift Schedule */}
          <div style={{ flexShrink: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 0.75rem', background: '#eef2f7', borderBottom: '1px solid #e2e8f0', fontSize: '0.68rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Shift Schedule</div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0.25rem 0.75rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <span style={{ flex: 1, fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trade</span>
              {SHIFT_DAY_LABELS.map((lbl, i) => (
                <span key={i} style={{ width: 24, textAlign: 'center', fontSize: '0.6rem', fontWeight: 700, color: i >= 5 ? '#f59e0b' : '#64748b', flexShrink: 0 }}>{lbl}</span>
              ))}
              <span style={{ width: 36, textAlign: 'right', fontSize: '0.6rem', color: '#94a3b8', flexShrink: 0 }}>Wk</span>
            </div>
            {SEGMENT_DEFINITIONS.filter(d => d.isLabor && activeKeys.includes(d.key)).map((def, ri) => {
              const shift = shiftSettings[def.key] ?? DEFAULT_SHIFT;
              return (
                <div key={def.key} style={{ display: 'flex', alignItems: 'center', padding: '0.28rem 0.75rem', borderBottom: '1px solid #f1f5f9', background: ri % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 110 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: LABOR_CHART_COLORS[def.key] ?? '#6b7280', flexShrink: 0, display: 'inline-block' }} />
                    <span style={{ fontSize: '0.7rem', color: '#374151', whiteSpace: 'nowrap' }}>{def.label}</span>
                  </div>
                  {SHIFT_DAY_KEYS.map((day, di) => (
                    <span key={day} style={{ width: 24, textAlign: 'center', fontSize: '0.7rem', flexShrink: 0, color: shift[day] === 0 ? '#cbd5e1' : di >= 5 ? '#d97706' : '#1e293b' }}>{shift[day]}</span>
                  ))}
                  <span style={{ width: 36, textAlign: 'right', fontSize: '0.7rem', fontWeight: 600, color: '#3b82f6', flexShrink: 0 }}>{weeklyHoursH(shift)}h</span>
                </div>
              );
            })}
          </div>
          {/* Remaining Labor chart */}
          {laborDatasets.length > 0 && (
            <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.875rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Remaining Labor Resources by Month</div>
              <div style={{ height: 200, position: 'relative' }}>
                <Line
                  data={{ labels: chartLabels, datasets: laborDatasets.map(ds => ({ label: ds.label, data: ds.data, borderColor: ds.color, backgroundColor: ds.color + '18', tension: 0.4, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2, fill: false })) }}
                  options={{ maintainAspectRatio: false, responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: laborDatasets.length > 1, position: 'top', labels: { boxWidth: 12, boxHeight: 2, font: { size: 10 }, padding: 8, usePointStyle: true, pointStyleWidth: 12 } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${(ctx.parsed.y ?? 0).toFixed(1)} workers` } } }, scales: { x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 }, maxRotation: 45, color: '#64748b' } }, y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 9 }, color: '#64748b', stepSize: 1 } } } }}
                />
              </div>
            </div>
          )}
          {/* Revenue chart */}
          {monthlyRevenue.some(v => v > 0) && (
            <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.875rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Revenue by Month</div>
              <div style={{ height: 200, position: 'relative' }}>
                <Bar
                  data={{ labels: chartLabels, datasets: [{ label: 'Revenue', data: monthlyRevenue, backgroundColor: '#10b981' + '70', borderColor: '#10b981', borderWidth: 1, borderRadius: 2 }] }}
                  options={{ maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `Revenue: ${fmtCompact(ctx.parsed.y)}` } } }, scales: { x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 }, maxRotation: 45, color: '#64748b' } }, y: { grid: { color: '#f1f5f9' }, beginAtZero: true, ticks: { font: { size: 9 }, color: '#64748b', callback: (v) => fmtCompact(v as number) } } } }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectHealthReport;
