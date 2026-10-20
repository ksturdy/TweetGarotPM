// @refresh reset
import React, { useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { vistaDataService, LaborTradeSummary } from '../../services/vistaData';
import { projectsApi } from '../../services/projects';
import { scheduleSegmentsService, ScheduleSegment } from '../../services/scheduleSegments';
import { format, addMonths, differenceInMonths, parseISO, startOfMonth } from 'date-fns';
import { ContourType, getContourMultipliers } from '../../utils/contours';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend);

const fmt = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '-';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
};

const fmtCashK = (v: number): string => {
  const a = Math.abs(v);
  if (a < 500) return '-';
  const s = a >= 1_000_000 ? `$${(a / 1_000_000).toFixed(1)}M` : `$${(a / 1_000).toFixed(0)}K`;
  return v < 0 ? `(${s})` : s;
};

const num = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

const LABOR_DURATION_RULES = [
  { min: 0,          max: 500_000,    months: 3 },
  { min: 500_000,    max: 2_000_000,  months: 6 },
  { min: 2_000_000,  max: 5_000_000,  months: 8 },
  { min: 5_000_000,  max: 10_000_000, months: 12 },
  { min: 10_000_000, max: Infinity,   months: 24 },
];
const laborDuration = (val: number) => LABOR_DURATION_RULES.find(r => val >= r.min && val < r.max)?.months ?? 6;

const laborAutoContour = (pct: number): ContourType => {
  if (pct < 15) return 'scurve';
  if (pct < 40) return 'bell';
  if (pct < 70) return 'back';
  if (pct < 90) return 'rampdown';
  return 'flat';
};

const dateToMonthOff = (dateStr: string | null | undefined): number | null => {
  if (!dateStr) return null;
  const d = parseISO(dateStr.slice(0, 10));
  if (isNaN(d.getTime())) return null;
  return differenceInMonths(startOfMonth(d), startOfMonth(new Date()));
};

// Segment key → trade/location mapping (mirrors ProjectFinancials)
const SEG_TRADE_MAP: { segKey: string; trade: string; location: string | null }[] = [
  { segKey: '40', trade: 'pf',    location: 'field' },
  { segKey: '45', trade: 'pf',    location: 'shop'  },
  { segKey: '30', trade: 'sm',    location: 'field' },
  { segKey: '35', trade: 'sm',    location: 'shop'  },
  { segKey: '50', trade: 'pl',    location: 'field' },
  { segKey: '55', trade: 'pl',    location: 'shop'  },
  { segKey: '70', trade: 'admin', location: null    },
];

const thS: React.CSSProperties = {
  textAlign: 'right', padding: '0.35rem 0.5rem', fontSize: '0.7rem', fontWeight: 600,
  color: '#475569', whiteSpace: 'nowrap', borderBottom: '2px solid #e2e8f0',
};
const tdS: React.CSSProperties = {
  textAlign: 'right', padding: '0.4rem 0.5rem', fontSize: '0.8rem',
  borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap',
};
const tfS: React.CSSProperties = {
  textAlign: 'right', padding: '0.4rem 0.5rem', fontSize: '0.8rem', fontWeight: 700,
  borderTop: '2px solid #e2e8f0', whiteSpace: 'nowrap',
};

const SRow: React.FC<{ label: string; value: string; highlight?: boolean; valueColor?: string; italic?: boolean }> = ({ label, value, highlight, valueColor, italic }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #f1f5f9' }}>
    <span style={{ color: italic ? '#94a3b8' : '#64748b', fontSize: '0.78rem', fontStyle: italic ? 'italic' : 'normal' }}>{label}</span>
    <span style={{ fontWeight: highlight ? 700 : 400, fontSize: '0.8rem', color: valueColor || (highlight ? '#1e293b' : '#334155'), fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </div>
);

const NON_LABOR_CATS = [
  { key: 'material', label: 'Material',           color: '#10b981' },
  { key: 'subs',     label: 'Subcontracts',       color: '#f59e0b' },
  { key: 'rentals',  label: 'Rentals',            color: '#8b5cf6' },
  { key: 'mep',      label: 'MEP Equipment',      color: '#06b6d4' },
  { key: 'gc',       label: 'General Conditions', color: '#ec4899' },
] as const;

type NonLaborKey = typeof NON_LABOR_CATS[number]['key'];

const cfSettingsKey = (pid: string) => `cf-settings-${pid}`;
const loadCfSetting = (pid: string, key: string, def: number): number => {
  try { return JSON.parse(localStorage.getItem(cfSettingsKey(pid)) ?? '{}')[key] ?? def; } catch { return def; }
};

const ProjectCashFlow: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [billingAdvanceMo, setBillingAdvanceMo] = React.useState(() => loadCfSetting(projectId ?? '', 'billingAdvanceMo', 0));
  const [paymentTermsDays, setPaymentTermsDays] = React.useState(() => loadCfSetting(projectId ?? '', 'paymentTermsDays', 0));

  const saveCfSetting = (patch: Record<string, number>) => {
    const current = { billingAdvanceMo, paymentTermsDays };
    localStorage.setItem(cfSettingsKey(projectId ?? ''), JSON.stringify({ ...current, ...patch }));
  };

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(r => r.data),
  });

  const { data: c } = useQuery({
    queryKey: ['vpContract', projectId],
    queryFn: () => vistaDataService.getContractByProjectId(Number(projectId)),
  });

  const { data: costSummary } = useQuery({
    queryKey: ['phaseCodeCostSummary', projectId, []],
    queryFn: () => vistaDataService.getPhaseCodeCostSummary(Number(projectId)),
    enabled: !!c,
  });

  const { data: segmentsData } = useQuery({
    queryKey: ['scheduleSegments', projectId],
    queryFn: () => scheduleSegmentsService.getSegments(Number(projectId)),
    enabled: !!projectId,
  });

  // Same 12-month + year column structure used across all finance tables
  const columns = useMemo(() => {
    const now = startOfMonth(new Date());
    const twelveOut = addMonths(now, 11);
    const cols: { key: string; label: string; isYear: boolean }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = addMonths(now, i);
      cols.push({ key: format(d, 'yyyy-MM'), label: format(d, 'MMM yy'), isYear: false });
    }
    const curYear = now.getFullYear();
    for (let yr = curYear; yr <= curYear + 3; yr++) {
      if (new Date(yr, 11, 1) > twelveOut) cols.push({ key: String(yr), label: String(yr), isYear: true });
    }
    return cols;
  }, []);

  const cashFlowData = useMemo(() => {
    if (!c || !costSummary || !project) return null;

    const schedulingMode = project.scheduling_mode ?? 'summary';
    const segments: ScheduleSegment[] = segmentsData?.segments ?? [];

    const backlog = num(c.backlog);
    const earnedRevenue = num(c.earned_revenue);
    const projectedRevenue = num(c.projected_revenue);
    const contractValue = num(c.contract_amount) || projectedRevenue;
    const pctCompletePct = projectedRevenue > 0 ? (earnedRevenue / projectedRevenue) * 100 : 0;
    const contour: ContourType = (c.user_selected_contour as ContourType) || laborAutoContour(pctCompletePct);

    // Project-level window (summary mode / fallback)
    const startOffset = Math.max(0, dateToMonthOff(c.user_adjusted_start_date) ?? 0);
    const endUserOffset = dateToMonthOff(c.user_adjusted_end_date);
    const endOffset = endUserOffset != null
      ? Math.max(startOffset + 1, Math.min(37, endUserOffset + 1))
      : startOffset + Math.max(1, Math.min(36, Math.ceil(
          laborDuration(contractValue) * (1 - (projectedRevenue > 0 ? earnedRevenue / projectedRevenue : 0))
        )));

    const now = startOfMonth(new Date());
    const twelveOut = addMonths(now, 11);

    // ── Helper: distribute a cost amount over a window ─────────────
    const distribute = (
      targetMap: Map<string, number>,
      cost: number,
      sOff: number,
      eOff: number,
      segContour: ContourType,
    ) => {
      const months = Math.max(0, eOff - sOff);
      if (months <= 0 || cost <= 0) return;
      const mults = getContourMultipliers(months, segContour);
      const base = cost / months;
      for (let i = 0; i < months; i++) {
        const monthIdx = sOff + i;
        if (monthIdx < 0) continue;
        const mk = format(addMonths(now, monthIdx), 'yyyy-MM');
        targetMap.set(mk, (targetMap.get(mk) ?? 0) + base * mults[i]);
      }
    };

    // ── Helper: resolve a segment's window (fallback to project) ───
    const resolveSegWindow = (segKey: string) => {
      const seg = segments.find(s => s.segment_key === segKey);
      if (seg?.start_date) {
        const sOff = dateToMonthOff(seg.start_date) ?? 0;
        const eUserOff = dateToMonthOff(seg.end_date);
        const eOff = eUserOff != null
          ? Math.max(sOff + 1, Math.min(37, eUserOff + 1))
          : sOff + Math.max(1, Math.min(36, Math.ceil(
              laborDuration(contractValue) * (1 - pctCompletePct / 100)
            )));
        return { sOff, eOff, segContour: (seg.contour_type as ContourType) || laborAutoContour(pctCompletePct) };
      }
      return { sOff: startOffset, eOff: endOffset, segContour: contour };
    };

    const cs = costSummary.costs;
    const lt = costSummary.labor_totals;

    const remainingNonLabor: Record<NonLaborKey, number> = {
      material: Math.max(0, cs.material.projected_cost - cs.material.jtd_cost),
      subs:     Math.max(0, cs.subcontracts.projected_cost - cs.subcontracts.jtd_cost),
      rentals:  Math.max(0, cs.rentals.projected_cost - cs.rentals.jtd_cost),
      mep:      Math.max(0, cs.mep_equipment.projected_cost - cs.mep_equipment.jtd_cost),
      gc:       Math.max(0, cs.general_conditions.projected_cost - cs.general_conditions.jtd_cost),
    };

    // Non-labor segment key mapping (matches SEGMENT_DEFINITIONS)
    const NON_LABOR_SEG_MAP: { segKey: string; catKey: NonLaborKey }[] = [
      { segKey: 'material',    catKey: 'material' },
      { segKey: 'subcontract', catKey: 'subs'     },
      { segKey: 'rental',      catKey: 'rentals'  },
      { segKey: 'equipment',   catKey: 'mep'      },
      { segKey: 'gc',          catKey: 'gc'       },
    ];

    const monthlyRevenue    = new Map<string, number>();
    const monthlyLaborCost  = new Map<string, number>();
    const monthlyNonLabor   = new Map<string, Partial<Record<NonLaborKey, number>>>();

    if (schedulingMode === 'cost_type') {
      // ── Cost Type mode: matches Schedule page "Revenue By Month" formula ──
      // Revenue = total remaining cost profile × (backlog / totalRemainingCost)

      // Labor per segment
      SEG_TRADE_MAP.forEach(({ segKey, trade, location }) => {
        const rows = (costSummary.labor as LaborTradeSummary[]).filter(l =>
          l.trade === trade && (location === null || l.location === location)
        );
        const remaining = rows.reduce((s, r) => s + Math.max(0, r.projected_cost - r.jtd_cost), 0);
        if (remaining <= 0) return;
        const { sOff, eOff, segContour } = resolveSegWindow(segKey);
        distribute(monthlyLaborCost, remaining, sOff, eOff, segContour);
      });

      // Non-labor per segment
      NON_LABOR_SEG_MAP.forEach(({ segKey, catKey }) => {
        const remaining = remainingNonLabor[catKey];
        if (remaining <= 0) return;
        const { sOff, eOff, segContour } = resolveSegWindow(segKey);
        const tmp = new Map<string, number>();
        distribute(tmp, remaining, sOff, eOff, segContour);
        tmp.forEach((v, mk) => {
          const existing = monthlyNonLabor.get(mk) ?? {};
          monthlyNonLabor.set(mk, { ...existing, [catKey]: (existing[catKey] ?? 0) + v });
        });
      });

      // Total monthly cost = labor + non-labor, scale to get revenue
      const monthlyTotalCost = new Map<string, number>();
      monthlyLaborCost.forEach((v, mk) => monthlyTotalCost.set(mk, (monthlyTotalCost.get(mk) ?? 0) + v));
      monthlyNonLabor.forEach((cats, mk) => {
        const catSum = NON_LABOR_CATS.reduce((s, cat) => s + (cats[cat.key] ?? 0), 0);
        monthlyTotalCost.set(mk, (monthlyTotalCost.get(mk) ?? 0) + catSum);
      });

      const totalRemCost = Array.from(monthlyTotalCost.values()).reduce((s, v) => s + v, 0);
      if (totalRemCost > 0 && backlog > 0) {
        const revMultiplier = backlog / totalRemCost;
        monthlyTotalCost.forEach((cost, mk) => monthlyRevenue.set(mk, cost * revMultiplier));
      }

    } else {
      // ── Summary mode: project window + single contour ─────────────
      const revMonths = Math.max(0, endOffset - startOffset);
      if (backlog > 0 && revMonths > 0) {
        const mults = getContourMultipliers(revMonths, contour);
        const base = backlog / revMonths;
        for (let i = 0; i < revMonths; i++) {
          const monthIdx = startOffset + i;
          if (monthIdx < 0) continue;
          const mk = format(addMonths(now, monthIdx), 'yyyy-MM');
          monthlyRevenue.set(mk, (monthlyRevenue.get(mk) ?? 0) + base * mults[i]);
        }
      }

      const remainingLabor = Math.max(0, lt.projected_cost - lt.jtd_cost);
      distribute(monthlyLaborCost, remainingLabor, startOffset, endOffset, contour);

      // Non-labor proportional to revenue in summary mode
      const totalAllRev = Array.from(monthlyRevenue.values()).reduce((s, v) => s + v, 0);
      if (totalAllRev > 0) {
        monthlyRevenue.forEach((rev, mk) => {
          const entry: Partial<Record<NonLaborKey, number>> = {};
          NON_LABOR_CATS.forEach(cat => {
            if (remainingNonLabor[cat.key] > 0) entry[cat.key] = (remainingNonLabor[cat.key] * rev) / totalAllRev;
          });
          monthlyNonLabor.set(mk, entry);
        });
      }
    }

    // ── Year column rollups ────────────────────────────────────────
    columns.filter(col => col.isYear).forEach(col => {
      let yrRev = 0, yrLabor = 0;
      const yrNL: Partial<Record<NonLaborKey, number>> = {};
      for (let m = 0; m < 12; m++) {
        const md = new Date(parseInt(col.key), m, 1);
        if (md <= twelveOut) continue;
        const mk = format(md, 'yyyy-MM');
        yrRev   += monthlyRevenue.get(mk) ?? 0;
        yrLabor += monthlyLaborCost.get(mk) ?? 0;
        const nl = monthlyNonLabor.get(mk) ?? {};
        NON_LABOR_CATS.forEach(cat => { yrNL[cat.key] = (yrNL[cat.key] ?? 0) + (nl[cat.key] ?? 0); });
      }
      if (yrRev   > 0) monthlyRevenue.set(col.key, yrRev);
      if (yrLabor > 0) monthlyLaborCost.set(col.key, yrLabor);
      if (Object.values(yrNL).some(v => (v ?? 0) > 0)) monthlyNonLabor.set(col.key, yrNL);
    });

    // ── Billing & collection timing shifts ────────────────────────
    // Billing advance: invoices go out N months before work is scheduled
    // Payment terms: cash arrives M months after invoice
    const billingShiftMo = -Math.round(billingAdvanceMo);         // negative = earlier
    const collectionShiftMo = Math.round(paymentTermsDays / 30);  // positive = later

    const shiftMonthly = (src: Map<string, number>, shift: number): Map<string, number> => {
      if (shift === 0) return src;
      const out = new Map<string, number>();
      src.forEach((v, k) => {
        if (!/^\d{4}-\d{2}$/.test(k)) return;
        const mk = format(addMonths(parseISO(k + '-01'), shift), 'yyyy-MM');
        out.set(mk, (out.get(mk) ?? 0) + v);
      });
      return out;
    };

    // monthlyRevenue = work schedule; billing = shifted earlier; collections = shifted later from billing
    const monthlyBillings    = shiftMonthly(monthlyRevenue, billingShiftMo);
    const monthlyCollections = shiftMonthly(monthlyBillings, collectionShiftMo);

    // Add year rollups for billing and collection maps
    columns.filter(col => col.isYear).forEach(col => {
      let yrBill = 0, yrColl = 0;
      for (let m = 0; m < 12; m++) {
        const md = new Date(parseInt(col.key), m, 1);
        if (md <= twelveOut) continue;
        const mk = format(md, 'yyyy-MM');
        yrBill += monthlyBillings.get(mk) ?? 0;
        yrColl += monthlyCollections.get(mk) ?? 0;
      }
      if (yrBill > 0) monthlyBillings.set(col.key, yrBill);
      if (yrColl > 0) monthlyCollections.set(col.key, yrColl);
    });

    // ── Net and cumulative, seeded from actual cash position ──────
    const jtdCashFlow = num(c.cash_flow);   // received − paid
    const openReceivables = num(c.open_receivables);

    // Open receivables: spread over current + next month
    const monthlyReceivables = new Map<string, number>();
    if (openReceivables > 0) {
      monthlyReceivables.set(format(now, 'yyyy-MM'), openReceivables / 2);
      monthlyReceivables.set(format(addMonths(now, 1), 'yyyy-MM'), openReceivables / 2);
    }

    const netCashFlow = new Map<string, number>();
    const cumulativeCashFlow = new Map<string, number>();
    let cumul = jtdCashFlow;
    columns.forEach(col => {
      const coll    = monthlyCollections.get(col.key) ?? 0;   // cash in = collections, not billings
      const labor   = monthlyLaborCost.get(col.key) ?? 0;
      const nl      = monthlyNonLabor.get(col.key) ?? {};
      const nlTotal = NON_LABOR_CATS.reduce((s, cat) => s + (nl[cat.key] ?? 0), 0);
      const recvbl  = monthlyReceivables.get(col.key) ?? 0;
      const net     = coll + recvbl - labor - nlTotal;
      netCashFlow.set(col.key, net);
      cumul += net;
      cumulativeCashFlow.set(col.key, cumul);
    });

    return {
      monthlyRevenue,
      monthlyBillings,
      monthlyCollections,
      monthlyLaborCost,
      monthlyNonLabor,
      monthlyReceivables,
      remainingLabor: Math.max(0, lt.projected_cost - lt.jtd_cost),
      remainingNonLabor,
      openReceivables,
      netCashFlow,
      cumulativeCashFlow,
      jtdCashFlow,
      schedulingMode,
      billingAdvanceMo,
      paymentTermsDays,
    };
  }, [c, costSummary, project, segmentsData, columns, billingAdvanceMo, paymentTermsDays]);

  const chartData = useMemo(() => {
    if (!cashFlowData) return null;

    // Collect every individual monthly key across all maps — covers full job duration
    const keySet = new Set<string>();
    const isMonthKey = (k: string) => /^\d{4}-\d{2}$/.test(k);
    cashFlowData.monthlyBillings.forEach((_, k) => { if (isMonthKey(k)) keySet.add(k); });
    cashFlowData.monthlyCollections.forEach((_, k) => { if (isMonthKey(k)) keySet.add(k); });
    cashFlowData.monthlyLaborCost.forEach((_, k) => { if (isMonthKey(k)) keySet.add(k); });
    cashFlowData.monthlyNonLabor.forEach((_, k) => { if (isMonthKey(k)) keySet.add(k); });

    const sortedKeys = Array.from(keySet).sort();
    const labels  = sortedKeys.map(k => format(parseISO(k + '-01'), 'MMM yy'));
    const billings = sortedKeys.map(k =>
      (cashFlowData.monthlyBillings.get(k) ?? 0) + (cashFlowData.monthlyReceivables.get(k) ?? 0)
    );
    const costs    = sortedKeys.map(k => {
      const labor = cashFlowData.monthlyLaborCost.get(k) ?? 0;
      const nl    = cashFlowData.monthlyNonLabor.get(k) ?? {};
      return labor + NON_LABOR_CATS.reduce((s, cat) => s + (nl[cat.key] ?? 0), 0);
    });
    const nets = billings.map((b, i) => b - costs[i]);

    // Recompute cumulative over the full sorted month sequence
    let cumul = cashFlowData.jtdCashFlow;
    const cumuls = nets.map(net => { cumul += net; return cumul; });

    return { labels, billings, costs, nets, cumuls };
  }, [cashFlowData]);

  const overUnderBilled = num(c?.billed_amount) - num(c?.earned_revenue);

  return (
    <div>
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <button onClick={() => navigate(-1)} style={{ color: '#64748b', fontSize: '0.8rem', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
            &larr; Back
          </button>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.2rem', color: '#1e293b' }}>Cash Flow Forecast</h2>
          {c && <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{c.contract_number}{c.description ? ` – ${c.description}` : ''}</div>}
          {project && <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{project.number} – {project.name}</div>}
        </div>
        <Link to={`/projects/${projectId}/financials`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}>
          ← Financials
        </Link>
      </div>

      {!c ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <h3 style={{ margin: 0, color: '#64748b' }}>No Vista Contract Linked</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Link a contract in the <Link to="/settings/vista">Vista Linking Manager</Link>
          </p>
        </div>
      ) : (
        <>
          {/* ── CONTRACT INFO BAR ───────────────────────────────────── */}
          <div className="card" style={{ padding: '0.6rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.78rem', color: '#334155' }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span><strong>Contract:</strong> {c.contract_number}</span>
              {c.customer_name && <span><strong>Customer:</strong> {c.customer_name}</span>}
              {c.project_manager_name && <span><strong>PM:</strong> {c.project_manager_name}</span>}
              {c.department_code && <span><strong>Dept:</strong> {c.department_code}</span>}
              <span><strong>Status:</strong> {c.status ?? '—'}</span>
              {c.bill_method && <span><strong>Bill Method:</strong> {c.bill_method}</span>}
              {cashFlowData && (
                <span style={{ marginLeft: 'auto', color: '#64748b' }}>
                  Labor schedule:{' '}
                  <strong style={{ color: '#2563eb' }}>
                    {cashFlowData.schedulingMode === 'cost_type' ? 'Cost Type (per segment)' : 'Summary (project window)'}
                  </strong>
                </span>
              )}
            </div>
          </div>

          {/* ── CURRENT STATUS CARDS ───────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className="card" style={{ padding: '0.6rem 0.75rem', borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.25rem', marginBottom: '0.35rem' }}>Cash Activity (JTD)</div>
              <SRow label="Cash Received" value={fmt(c.received_amount)} />
              <SRow label="Cash Paid" value={fmt(c.actual_cost)} />
              <SRow label="Net Cash Flow" value={fmt(c.cash_flow)} highlight
                valueColor={num(c.cash_flow) > 0 ? '#10b981' : num(c.cash_flow) < 0 ? '#ef4444' : undefined} />
            </div>
            <div className="card" style={{ padding: '0.6rem 0.75rem', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.25rem', marginBottom: '0.35rem' }}>Billing Status</div>
              <SRow label="Billed To Date" value={fmt(c.billed_amount)} />
              <SRow label="Earned Revenue" value={fmt(c.earned_revenue)} />
              <SRow label="Over/(Under) Billed" value={fmt(overUnderBilled)} highlight
                valueColor={overUnderBilled > 0 ? '#10b981' : overUnderBilled < 0 ? '#ef4444' : undefined} />
              {num(c.open_receivables) > 0 && <SRow label="Open Receivables" value={fmt(c.open_receivables)} italic />}
            </div>
            <div className="card" style={{ padding: '0.6rem 0.75rem', borderLeft: '3px solid #3b82f6' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.25rem', marginBottom: '0.35rem' }}>Backlog & Revenue</div>
              <SRow label="Revised Contract" value={fmt(c.contract_amount)} />
              <SRow label="Projected Revenue" value={fmt(c.projected_revenue)} />
              <SRow label="Backlog" value={fmt(c.backlog)} highlight />
            </div>
          </div>

          {/* ── CHARTS ────────────────────────────────────────────── */}
          {chartData && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {/* Billings vs Costs + Cumulative combo */}
              <div className="card" style={{ padding: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Monthly Billings vs Costs
                  <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: '0.5rem' }}>· Cumulative on right axis</span>
                </div>
                <div style={{ height: 240 }}>
                  <Bar
                    data={{
                      labels: chartData.labels,
                      datasets: [
                        {
                          type: 'bar' as const,
                          label: 'Proj Billings',
                          data: chartData.billings,
                          backgroundColor: 'rgba(16, 185, 129, 0.75)',
                          borderColor: '#10b981',
                          borderWidth: 1,
                          borderRadius: 3,
                          yAxisID: 'y',
                          order: 2,
                        },
                        {
                          type: 'bar' as const,
                          label: 'Total Cost Out',
                          data: chartData.costs,
                          backgroundColor: 'rgba(239, 68, 68, 0.65)',
                          borderColor: '#ef4444',
                          borderWidth: 1,
                          borderRadius: 3,
                          yAxisID: 'y',
                          order: 3,
                        },
                        {
                          type: 'line' as const,
                          label: 'Cumulative',
                          data: chartData.cumuls,
                          borderColor: '#2563eb',
                          backgroundColor: 'rgba(37, 99, 235, 0.08)',
                          borderWidth: 2,
                          pointRadius: 3,
                          pointBackgroundColor: chartData.cumuls.map(v => v >= 0 ? '#10b981' : '#ef4444'),
                          fill: true,
                          tension: 0.35,
                          yAxisID: 'y2',
                          order: 1,
                        } as any,
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: { mode: 'index', intersect: false },
                      plugins: {
                        legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 }, padding: 8 } },
                        tooltip: {
                          callbacks: {
                            label: (ctx: any) => {
                              const v = ctx.parsed.y ?? 0;
                              const a = Math.abs(v);
                              const s = a >= 1_000_000 ? `$${(a / 1_000_000).toFixed(1)}M` : a >= 1000 ? `$${(a / 1_000).toFixed(0)}K` : '$0';
                              return ` ${ctx.dataset.label}: ${v < 0 ? `(${s})` : s}`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 } } },
                        y: {
                          position: 'left',
                          grid: { color: '#f1f5f9' },
                          ticks: {
                            font: { size: 9 },
                            maxTicksLimit: 5,
                            callback: (v: any) => { const a = Math.abs(Number(v)); return a >= 1_000_000 ? `$${(a/1e6).toFixed(1)}M` : a >= 1000 ? `$${(a/1000).toFixed(0)}K` : '$0'; },
                          },
                        },
                        y2: {
                          position: 'right',
                          grid: { drawOnChartArea: false },
                          ticks: {
                            font: { size: 9 },
                            maxTicksLimit: 5,
                            callback: (v: any) => { const a = Math.abs(Number(v)); const s = a >= 1_000_000 ? `$${(a/1e6).toFixed(1)}M` : a >= 1000 ? `$${(a/1000).toFixed(0)}K` : '$0'; return Number(v) < 0 ? `(${s})` : s; },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>

              {/* Net Monthly Cash Flow bars */}
              <div className="card" style={{ padding: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Net Monthly Cash Flow
                </div>
                <div style={{ height: 240 }}>
                  <Bar
                    data={{
                      labels: chartData.labels,
                      datasets: [
                        {
                          label: 'Net',
                          data: chartData.nets,
                          backgroundColor: chartData.nets.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.75)' : 'rgba(239, 68, 68, 0.65)'),
                          borderColor: chartData.nets.map(v => v >= 0 ? '#10b981' : '#ef4444'),
                          borderWidth: 1,
                          borderRadius: 3,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (ctx: any) => {
                              const v = ctx.parsed.y ?? 0;
                              const a = Math.abs(v);
                              const s = a >= 1_000_000 ? `$${(a/1e6).toFixed(1)}M` : a >= 1000 ? `$${(a/1000).toFixed(0)}K` : '$0';
                              return ` Net: ${v < 0 ? `(${s})` : s}`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 } } },
                        y: {
                          grid: { color: '#f1f5f9' },
                          ticks: {
                            font: { size: 9 },
                            maxTicksLimit: 5,
                            callback: (v: any) => { const a = Math.abs(Number(v)); const s = a >= 1_000_000 ? `$${(a/1e6).toFixed(1)}M` : a >= 1000 ? `$${(a/1000).toFixed(0)}K` : '$0'; return Number(v) < 0 ? `(${s})` : s; },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── FORECAST TABLE ─────────────────────────────────────── */}
          {cashFlowData ? (
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase' }}>Projected Cash Flow</span>

                {/* ── Billing lead ── */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#475569' }}>
                  <span>Billing Lead:</span>
                  <select
                    value={billingAdvanceMo}
                    onChange={e => { const v = Number(e.target.value); setBillingAdvanceMo(v); saveCfSetting({ billingAdvanceMo: v }); }}
                    style={{ fontSize: '0.72rem', padding: '0.1rem 0.3rem', border: billingAdvanceMo > 0 ? '1px solid #16a34a' : '1px solid #e2e8f0', borderRadius: '3px', background: billingAdvanceMo > 0 ? '#dcfce7' : '#fff', color: billingAdvanceMo > 0 ? '#15803d' : '#334155', cursor: 'pointer' }}
                    title="How far in advance you can bill before work is performed"
                  >
                    <option value={0}>None</option>
                    <option value={1}>1 month</option>
                    <option value={2}>2 months</option>
                  </select>
                </label>

                {/* ── Payment terms ── */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#475569' }}>
                  <span>Payment Terms:</span>
                  <select
                    value={paymentTermsDays}
                    onChange={e => { const v = Number(e.target.value); setPaymentTermsDays(v); saveCfSetting({ paymentTermsDays: v }); }}
                    style={{ fontSize: '0.72rem', padding: '0.1rem 0.3rem', border: paymentTermsDays > 0 ? '1px solid #16a34a' : '1px solid #e2e8f0', borderRadius: '3px', background: paymentTermsDays > 0 ? '#dcfce7' : '#fff', color: paymentTermsDays > 0 ? '#15803d' : '#334155', cursor: 'pointer' }}
                    title="How long after billing you typically receive payment"
                  >
                    <option value={0}>Immediate</option>
                    <option value={30}>Net 30</option>
                    <option value={45}>Net 45</option>
                    <option value={60}>Net 60</option>
                    <option value={90}>Net 90</option>
                  </select>
                </label>

                <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 'auto' }}>
                  JTD cash:{' '}<strong style={{ color: cashFlowData.jtdCashFlow >= 0 ? '#10b981' : '#ef4444' }}>{fmt(cashFlowData.jtdCashFlow)}</strong>
                  {cashFlowData.openReceivables > 0 && <span> · AR: <strong style={{ color: '#2563eb' }}>{fmt(cashFlowData.openReceivables)}</strong></span>}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '180px' }} />
                  {columns.map(col => <col key={col.key} style={{ width: col.isYear ? '70px' : '60px' }} />)}
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={{ ...thS, textAlign: 'left', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 1 }}>Item</th>
                    {columns.map(col => (
                      <th key={col.key} style={{ ...thS, background: col.isYear ? '#f1f5f9' : '#f8fafc' }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Revenue / Billings */}
                  <tr>
                    <td style={{ ...tdS, textAlign: 'left', fontWeight: 600, color: '#10b981', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 1 }}>Proj Billings</td>
                    {columns.map(col => {
                      const v = cashFlowData.monthlyBillings.get(col.key) ?? 0;
                      return <td key={col.key} style={{ ...tdS, color: v > 500 ? '#10b981' : '#cbd5e1', background: col.isYear ? '#fafafa' : undefined }}>{fmtCashK(v)}</td>;
                    })}
                  </tr>
                  {/* Est. Collections — shown when payment terms shift the timing */}
                  {cashFlowData.paymentTermsDays > 0 && (
                    <tr>
                      <td style={{ ...tdS, textAlign: 'left', fontWeight: 600, color: '#0ea5e9', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 1, fontStyle: 'italic' }}>Est. Collections</td>
                      {columns.map(col => {
                        const v = cashFlowData.monthlyCollections.get(col.key) ?? 0;
                        return <td key={col.key} style={{ ...tdS, color: v > 500 ? '#0ea5e9' : '#cbd5e1', background: col.isYear ? '#fafafa' : undefined, fontStyle: 'italic' }}>{fmtCashK(v)}</td>;
                      })}
                    </tr>
                  )}
                  {/* Open Receivables */}
                  {cashFlowData.openReceivables > 0 && (
                    <tr>
                      <td style={{ ...tdS, textAlign: 'left', fontWeight: 600, color: '#2563eb', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 1 }}>Open Receivables</td>
                      {columns.map(col => {
                        const v = cashFlowData.monthlyReceivables.get(col.key) ?? 0;
                        return <td key={col.key} style={{ ...tdS, color: v > 500 ? '#2563eb' : '#cbd5e1', background: col.isYear ? '#fafafa' : undefined }}>{fmtCashK(v)}</td>;
                      })}
                    </tr>
                  )}
                  {/* Labor */}
                  {cashFlowData.remainingLabor > 0 && (
                    <tr>
                      <td style={{ ...tdS, textAlign: 'left', fontWeight: 600, color: '#3b82f6', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 1 }}>Labor</td>
                      {columns.map(col => {
                        const v = cashFlowData.monthlyLaborCost.get(col.key) ?? 0;
                        return <td key={col.key} style={{ ...tdS, color: v > 500 ? '#ef4444' : '#cbd5e1', background: col.isYear ? '#fafafa' : undefined }}>{v > 500 ? `(${fmtCashK(v)})` : '-'}</td>;
                      })}
                    </tr>
                  )}
                  {/* Non-labor rows */}
                  {NON_LABOR_CATS.filter(cat => cashFlowData.remainingNonLabor[cat.key] > 0).map(cat => (
                    <tr key={cat.key}>
                      <td style={{ ...tdS, textAlign: 'left', fontWeight: 600, color: cat.color, position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 1 }}>{cat.label}</td>
                      {columns.map(col => {
                        const v = cashFlowData.monthlyNonLabor.get(col.key)?.[cat.key] ?? 0;
                        return <td key={col.key} style={{ ...tdS, color: v > 500 ? '#ef4444' : '#cbd5e1', background: col.isYear ? '#fafafa' : undefined }}>{v > 500 ? `(${fmtCashK(v)})` : '-'}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <td style={{ ...tfS, textAlign: 'left', position: 'sticky', left: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>Net Monthly Cash Flow</td>
                    {columns.map(col => {
                      const net = cashFlowData.netCashFlow.get(col.key) ?? 0;
                      return <td key={col.key} style={{ ...tfS, color: Math.abs(net) > 500 ? (net > 0 ? '#10b981' : '#ef4444') : '#cbd5e1', background: col.isYear ? '#f4f6f9' : undefined }}>{fmtCashK(net)}</td>;
                    })}
                  </tr>
                  <tr style={{ backgroundColor: '#eff6ff' }}>
                    <td style={{ ...tfS, textAlign: 'left', color: '#2563eb', position: 'sticky', left: 0, backgroundColor: '#eff6ff', zIndex: 1 }}>
                      Cumulative Cash Flow
                      <span style={{ fontWeight: 400, fontSize: '0.65rem', color: '#94a3b8', marginLeft: '0.4rem' }}>
                        (starts: {fmt(cashFlowData.jtdCashFlow)})
                      </span>
                    </td>
                    {columns.map(col => {
                      const cumul = cashFlowData.cumulativeCashFlow.get(col.key) ?? 0;
                      return <td key={col.key} style={{ ...tfS, fontWeight: 700, color: cumul > 0 ? '#10b981' : cumul < 0 ? '#ef4444' : '#cbd5e1', background: col.isYear ? '#e8f0fe' : '#eff6ff' }}>{fmtCashK(cumul)}</td>;
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              Loading cost summary data…
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectCashFlow;
