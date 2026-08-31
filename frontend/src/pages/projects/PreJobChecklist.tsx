import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { vistaDataService, PhaseCodeCostSummary, VPContract } from '../../services/vistaData';
import { projectAssignmentsApi, ProjectAssignment, AssignToProjectInput } from '../../services/projectAssignments';
import { ASSIGNMENT_TRADES } from '../../services/labor';
import api from '../../services/api';
import {
  preJobChecklistApi,
  PreJobChecklist,
  ChecklistSection,
  LaborTradeRow,
  MaterialItemRow,
  SubcontractItemRow,
  GenericItemRow,
  OtherContact,
} from '../../services/preJobChecklist';
import { scheduleSegmentsService } from '../../services/scheduleSegments';
import { getContourMultipliers, type ContourType } from '../../utils/contours';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import './PreJobChecklist.css';

// Management/office roles go directly to active — no labor coordinator approval needed
const MGMT_ROLES = [
  'Project Manager',
  'Assistant PM',
  'Project Coordinator',
  'Safety Manager',
  'BIM Lead',
  'BIM Manager',
  'Project Engineer',
] as const;

// Field roles route through labor coordinator as planned → confirmed
const FIELD_ROLES = [
  'Superintendent',
  'Foreman',
  'Journeyman',
  'Apprentice 5',
  'Apprentice 4',
  'Apprentice 3',
  'Apprentice 2',
  'Apprentice 1',
  'Pre-Apprentice',
  'Helper',
] as const;

const isFieldRole = (r: string) => (FIELD_ROLES as readonly string[]).includes(r);

interface EmployeeSearchResult {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  job_title?: string;
  title?: string | null;
  trade?: string | null;
}


// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined, decimals = 0) =>
  n == null ? '—' : `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

const fmtHrs = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' hrs';

const uid = () => Math.random().toString(36).slice(2, 10);

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const monthsBetween = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
};

const monthsRemaining = (end: string) => {
  const today = new Date();
  const e = new Date(end);
  return Math.max(0, (e.getFullYear() - today.getFullYear()) * 12 + (e.getMonth() - today.getMonth()));
};

const TRADE_LABELS: Record<string, string> = {
  pf: 'Pipefitter',
  sm: 'Sheet Metal',
  pl: 'Plumber',
  admin: 'Admin / Office',
  other: 'Other',
};

// ── TrashIcon ──────────────────────────────────────────────────────────────────
const TrashIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 13, height: 13 }}>
    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
  </svg>
);

// ── Chevron ────────────────────────────────────────────────────────────────────
interface ChevronProps { open: boolean }
const Chevron: React.FC<ChevronProps> = ({ open }) => (
  <svg viewBox="0 0 20 20" fill="currentColor"
    style={{ width: 16, height: 16, flexShrink: 0, transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'inherit' }}>
    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
  </svg>
);

// ── Vista Labor Table ──────────────────────────────────────────────────────────
interface VistaLaborTableProps { costSummary: PhaseCodeCostSummary }
const VistaLaborTable: React.FC<VistaLaborTableProps> = ({ costSummary }) => {
  const trades = costSummary.labor ?? [];
  const totals = costSummary.labor_totals;

  const grouped: Record<string, { est_hours: number; jtd_hours: number; est_cost: number; jtd_cost: number; projected_cost: number }> = {};
  for (const t of trades) {
    const key = t.trade;
    if (!grouped[key]) grouped[key] = { est_hours: 0, jtd_hours: 0, est_cost: 0, jtd_cost: 0, projected_cost: 0 };
    grouped[key].est_hours += t.est_hours;
    grouped[key].jtd_hours += t.jtd_hours;
    grouped[key].est_cost += t.est_cost;
    grouped[key].jtd_cost += t.jtd_cost;
    grouped[key].projected_cost += t.projected_cost;
  }

  if (Object.keys(grouped).length === 0)
    return <p className="pjc-vista-no-data">No Vista phase code data for labor.</p>;

  return (
    <table className="pjc-vista-table">
      <thead>
        <tr><th>Trade</th><th>Est Hrs</th><th>JTD Hrs</th><th>Est Cost</th><th>JTD Cost</th><th>Projected</th></tr>
      </thead>
      <tbody>
        {Object.entries(grouped).map(([trade, vals]) => (
          <tr key={trade}>
            <td>{TRADE_LABELS[trade] ?? trade.toUpperCase()}</td>
            <td>{fmtHrs(vals.est_hours)}</td>
            <td>{fmtHrs(vals.jtd_hours)}</td>
            <td>{fmt(vals.est_cost)}</td>
            <td>{fmt(vals.jtd_cost)}</td>
            <td>{fmt(vals.projected_cost)}</td>
          </tr>
        ))}
        {totals && (
          <tr>
            <td>Total</td>
            <td>{fmtHrs(totals.est_hours)}</td>
            <td>{fmtHrs(totals.jtd_hours)}</td>
            <td>{fmt(totals.est_cost)}</td>
            <td>{fmt(totals.jtd_cost)}</td>
            <td>{fmt(totals.projected_cost)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

// ── Vista Cost Row ─────────────────────────────────────────────────────────────
interface VistaCostRowProps {
  label: string;
  data: { est_cost: number; jtd_cost: number; projected_cost: number } | undefined;
}
const VistaCostRow: React.FC<VistaCostRowProps> = ({ label, data }) => (
  <tr>
    <td>{label}</td>
    <td>{fmt(data?.est_cost)}</td>
    <td>{fmt(data?.jtd_cost)}</td>
    <td>{fmt(data?.projected_cost)}</td>
  </tr>
);

// ── Labor Forecast Summary ─────────────────────────────────────────────────────
interface LaborForecastProps {
  contract: VPContract;
  costSummary: PhaseCodeCostSummary | undefined;
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  projectId: string;
}
const FORECAST_TRADES = [
  { key: 'pf' as const, label: 'Pipefitter',  color: '#3b82f6' },
  { key: 'sm' as const, label: 'Sheet Metal', color: '#10b981' },
  { key: 'pl' as const, label: 'Plumber',     color: '#f59e0b' },
];

const HPP = 160; // hours per person per month

// Sum est/jtd hours for a trade key from the phase-code labor breakdown
function tradeHoursFromSummary(labor: PhaseCodeCostSummary['labor'], tradeKey: 'pf' | 'sm' | 'pl') {
  const rows = labor.filter(r => r.trade === tradeKey);
  return {
    est:  rows.reduce((s, r) => s + (r.est_hours  ?? 0), 0),
    jtd:  rows.reduce((s, r) => s + (r.jtd_hours  ?? 0), 0),
  };
}

// Primary field segment key per trade (used to look up contour type)
const TRADE_SEGMENT_KEY: Record<'pf' | 'sm' | 'pl', string> = { pf: '40', sm: '30', pl: '50' };

const LaborForecastSummary: React.FC<LaborForecastProps> = ({ contract, costSummary, startDate, endDate, projectId }) => {
  const { data: segmentsData } = useQuery({
    queryKey: ['scheduleSegments', projectId],
    queryFn: () => scheduleSegmentsService.getSegments(Number(projectId)),
    enabled: !!projectId,
  });

  const hasDates = !!startDate && !!endDate;
  const totalDurationMonths = hasDates ? monthsBetween(startDate!, endDate!) : null;
  const remMonths = hasDates ? monthsRemaining(endDate!) : null;

  // Use phase-code labor totals when available (more reliable than contract columns)
  const labor = costSummary?.labor ?? [];
  const totalEstHrs  = labor.length > 0 ? labor.reduce((s, r) => s + r.est_hours,  0) : (contract.total_hours_estimate  ?? 0);
  const totalJtdHrs  = labor.length > 0 ? labor.reduce((s, r) => s + r.jtd_hours,  0) : (contract.total_hours_jtd       ?? 0);
  const remainingHrs = Math.max(0, totalEstHrs - totalJtdHrs);
  const avgMonthlyHrs = remMonths && remMonths > 0 ? Math.round(remainingHrs / remMonths) : null;

  // Trade rows — prefer phase-code data, fall back to contract columns
  const tradeRows = FORECAST_TRADES.map(t => {
    if (labor.length > 0) {
      const h = tradeHoursFromSummary(labor, t.key);
      return { label: t.label, est: h.est, jtd: h.jtd, proj: null as number | null };
    }
    return {
      label: t.label,
      est:  contract[`${t.key}_hours_estimate` as keyof VPContract] as number | null,
      jtd:  contract[`${t.key}_hours_jtd`      as keyof VPContract] as number | null,
      proj: contract[`${t.key}_hours_projected` as keyof VPContract] as number | null,
    };
  }).filter(r => (r.est ?? 0) + (r.jtd ?? 0) + (r.proj ?? 0) > 0);

  // ── Chart: monthly headcount by trade ──────────────────────────────────────
  // Build month buckets from today (or startDate if in future) through endDate
  const chartMonths: { label: string; ym: string; pf: number; sm: number; pl: number }[] = [];
  if (hasDates && remMonths && remMonths > 0) {
    const today = new Date(); today.setDate(1); today.setHours(0, 0, 0, 0);
    const endDt = new Date(endDate!); endDt.setDate(1);
    const chartStart = new Date(Math.max(today.getTime(), new Date(startDate!).getTime()));
    chartStart.setDate(1);

    const cur = new Date(chartStart);
    while (cur <= endDt) {
      const ym = cur.toISOString().slice(0, 7);
      const lbl = cur.toLocaleDateString('en-US', { month: 'short' });
      chartMonths.push({ label: lbl, ym, pf: 0, sm: 0, pl: 0 });
      cur.setMonth(cur.getMonth() + 1);
    }

    // Spread each trade's remaining hours across months using the segment's contour type
    if (chartMonths.length > 0) {
      FORECAST_TRADES.forEach(t => {
        let remaining: number;
        if (labor.length > 0) {
          const h = tradeHoursFromSummary(labor, t.key);
          remaining = Math.max(0, h.est - h.jtd);
        } else {
          const proj = contract[`${t.key}_hours_projected` as keyof VPContract] as number | null;
          const est  = contract[`${t.key}_hours_estimate`  as keyof VPContract] as number | null;
          const jtd  = contract[`${t.key}_hours_jtd`       as keyof VPContract] as number | null;
          remaining = Math.max(0, (proj ?? est ?? 0) - (jtd ?? 0));
        }
        const segKey = TRADE_SEGMENT_KEY[t.key];
        const seg = segmentsData?.segments.find(s => s.segment_key === segKey);
        const contour = (seg?.contour_type ?? 'flat') as ContourType;
        const multipliers = getContourMultipliers(chartMonths.length, contour);
        const totalMultiplier = multipliers.reduce((s, v) => s + v, 0) || 1;
        chartMonths.forEach((m, i) => {
          m[t.key] = (remaining * (multipliers[i] / totalMultiplier)) / HPP;
        });
      });
    }
  }

  const chartH = 200;
  const maxHC = Math.max(...chartMonths.map(m => m.pf + m.sm + m.pl), 1);
  const yMax = Math.ceil(maxHC / 5) * 5 || 10;
  const barCount = chartMonths.length;
  const barWidth = barCount > 0 ? 100 / barCount : 0;
  const labelEvery = barCount <= 12 ? 1 : barCount <= 18 ? 2 : 3;

  // Year boundary markers
  const yearBounds: { index: number; label: string }[] = [];
  let lastYr = '';
  chartMonths.forEach((m, i) => { const yr = m.ym.slice(0, 4); if (yr !== lastYr) { yearBounds.push({ index: i, label: yr }); lastYr = yr; } });

  return (
    <div className="pjc-forecast-block">
      <div className="pjc-forecast-kpi-row">
        <div className="pjc-forecast-kpi">
          <span className="pjc-forecast-kpi-label">Project Duration</span>
          <span className="pjc-forecast-kpi-value">{totalDurationMonths != null ? `${totalDurationMonths} mos` : '—'}</span>
          {hasDates && <span className="pjc-forecast-kpi-sub">{fmtDate(startDate)} – {fmtDate(endDate)}</span>}
        </div>
        <div className="pjc-forecast-kpi">
          <span className="pjc-forecast-kpi-label">Months Remaining</span>
          <span className="pjc-forecast-kpi-value">{remMonths != null ? `${remMonths} mos` : '—'}</span>
        </div>
        <div className="pjc-forecast-kpi">
          <span className="pjc-forecast-kpi-label">Remaining Hours</span>
          <span className="pjc-forecast-kpi-value">{remainingHrs > 0 ? fmtHrs(remainingHrs) : '—'}</span>
          <span className="pjc-forecast-kpi-sub">
            {fmtHrs(totalEstHrs)} est · {fmtHrs(totalJtdHrs)} JTD
          </span>
        </div>
        <div className="pjc-forecast-kpi">
          <span className="pjc-forecast-kpi-label">Avg Monthly Need</span>
          <span className="pjc-forecast-kpi-value">{avgMonthlyHrs != null ? fmtHrs(avgMonthlyHrs) : '—'}</span>
          <span className="pjc-forecast-kpi-sub">hrs/month to finish on time</span>
        </div>
      </div>

      {/* ── Stacked headcount chart ── */}
      {chartMonths.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Projected Headcount by Trade
          </div>
          <div style={{ height: chartH + 48, position: 'relative' }}>
            <svg width="100%" height={chartH + 48} style={{ overflow: 'visible' }}>
              <text x="0" y="10"          fontSize="10" fill="#64748b">{yMax} ppl</text>
              <text x="0" y={chartH / 2} fontSize="10" fill="#64748b">{Math.round(yMax / 2)}</text>
              <text x="0" y={chartH}     fontSize="10" fill="#64748b">0</text>
              <line x1="40" y1="0"          x2="100%" y2="0"          stroke="#e2e8f0" strokeDasharray="2,2" />
              <line x1="40" y1={chartH / 2} x2="100%" y2={chartH / 2} stroke="#e2e8f0" strokeDasharray="2,2" />
              <line x1="40" y1={chartH}     x2="100%" y2={chartH}     stroke="#e2e8f0" />
              <g transform="translate(45,0)">
                {yearBounds.map(b => (
                  <line key={b.index}
                    x1={`${(b.index / barCount) * 95}%`} y1="0"
                    x2={`${(b.index / barCount) * 95}%`} y2={chartH + 5}
                    stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,2" />
                ))}
                {chartMonths.map((m, i) => {
                  const xPct = (i / barCount) * 95;
                  const plH  = yMax > 0 ? (m.pl / yMax) * chartH : 0;
                  const smH  = yMax > 0 ? (m.sm / yMax) * chartH : 0;
                  const pfH  = yMax > 0 ? (m.pf / yMax) * chartH : 0;
                  const total = m.pf + m.sm + m.pl;
                  const tip = `${m.ym}: PF ${m.pf.toFixed(1)}, SM ${m.sm.toFixed(1)}, PL ${m.pl.toFixed(1)} = ${total.toFixed(1)} people`;
                  return (
                    <g key={m.ym}>
                      <rect x={`${xPct}%`} y={chartH - plH}             width={`${barWidth * 0.82}%`} height={plH}  fill="#f59e0b" rx="1"><title>{tip}</title></rect>
                      <rect x={`${xPct}%`} y={chartH - plH - smH}       width={`${barWidth * 0.82}%`} height={smH}  fill="#10b981" rx="1"><title>{tip}</title></rect>
                      <rect x={`${xPct}%`} y={chartH - plH - smH - pfH} width={`${barWidth * 0.82}%`} height={pfH}  fill="#3b82f6" rx="1"><title>{tip}</title></rect>
                      {i % labelEvery === 0 && (
                        <text x={`${xPct + barWidth * 0.41}%`} y={chartH + 14} fontSize="9" fill="#64748b" textAnchor="middle">{m.label}</text>
                      )}
                    </g>
                  );
                })}
                {yearBounds.map((b, idx) => {
                  const xStart = (b.index / barCount) * 95;
                  const xEnd   = yearBounds[idx + 1] ? (yearBounds[idx + 1].index / barCount) * 95 : 95;
                  return (
                    <text key={`yr-${b.index}`} x={`${(xStart + xEnd) / 2}%`} y={chartH + 30}
                      fontSize="11" fontWeight="600" fill="#1e293b" textAnchor="middle">{b.label}</text>
                  );
                })}
              </g>
            </svg>
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            {FORECAST_TRADES.filter(t => tradeRows.some(r => r.label === t.label)).map(t => (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#374151' }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: t.color, display: 'inline-block' }} />
                {t.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {tradeRows.length > 0 && (
        <table className="pjc-vista-table" style={{ marginTop: '0.875rem' }}>
          <thead>
            <tr><th>Trade</th><th>Est Hrs</th><th>JTD Hrs</th><th>Remaining</th></tr>
          </thead>
          <tbody>
            {tradeRows.map(r => {
              const rem = Math.max(0, (r.proj ?? r.est ?? 0) - (r.jtd ?? 0));
              return (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{fmtHrs(r.est)}</td>
                  <td>{fmtHrs(r.jtd)}</td>
                  <td style={{ fontWeight: 600, color: rem > 0 ? '#002356' : '#6b7280' }}>{rem > 0 ? fmtHrs(rem) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: '0.75rem' }}>
        <Link to={`/projects/${projectId}/financials`} className="pjc-link-cta">
          View full labor forecast with monthly projections →
        </Link>
      </div>
    </div>
  );
};

// ── Shared employee search hook ────────────────────────────────────────────────
const useEmpSearch = () => {
  const [empQuery, setEmpQuery] = useState('');
  const [empResults, setEmpResults] = useState<EmployeeSearchResult[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeSearchResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (empQuery.length < 2) { setEmpResults([]); setShowDropdown(false); return; }
    api.get<EmployeeSearchResult[]>(`/project-assignments/search-employees?q=${encodeURIComponent(empQuery)}`)
      .then(r => { setEmpResults(r.data); setShowDropdown(true); })
      .catch(() => {});
  }, [empQuery]);

  const select = (emp: EmployeeSearchResult, onSelect?: (emp: EmployeeSearchResult) => void) => {
    setSelectedEmp(emp);
    setEmpQuery(`${emp.first_name} ${emp.last_name}`);
    setShowDropdown(false);
    onSelect?.(emp);
  };

  const reset = () => { setEmpQuery(''); setSelectedEmp(null); setEmpResults([]); setShowDropdown(false); };
  const clearSelection = () => { setSelectedEmp(null); };

  return { empQuery, setEmpQuery, empResults, selectedEmp, showDropdown, select, reset, clearSelection };
};

// ── Employee search input with dropdown ────────────────────────────────────────
interface EmpSearchInputProps {
  query: string;
  results: EmployeeSearchResult[];
  showDropdown: boolean;
  onChange: (v: string) => void;
  onSelect: (emp: EmployeeSearchResult) => void;
  onClear: () => void;
}
const EmpSearchInput: React.FC<EmpSearchInputProps> = ({ query, results, showDropdown, onChange, onSelect, onClear }) => (
  <div style={{ position: 'relative' }}>
    <input type="text" className="pjc-nominate-input" value={query}
      onChange={e => { onChange(e.target.value); onClear(); }}
      placeholder="Search by name…" autoComplete="off" />
    {showDropdown && results.length > 0 && (
      <div className="pjc-emp-dropdown">
        {results.map(e => (
          <button key={e.id} className="pjc-emp-dropdown-item" onMouseDown={() => onSelect(e)}>
            <span className="pjc-emp-name">{e.first_name} {e.last_name}</span>
            {(e.title || e.trade) && (
              <span className="pjc-emp-meta">{[e.title, e.trade].filter(Boolean).join(' · ')}</span>
            )}
          </button>
        ))}
      </div>
    )}
  </div>
);

// ── Office Team Section ────────────────────────────────────────────────────────
interface OfficeSectionProps { assignments: ProjectAssignment[]; projectId: string }
const OfficeSection: React.FC<OfficeSectionProps> = ({ assignments, projectId }) => {
  const { toast } = useTitanFeedback();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [role, setRole] = useState('');
  const empSearch = useEmpSearch();

  const addMutation = useMutation({
    mutationFn: () => {
      if (!empSearch.selectedEmp || !role) throw new Error('Employee and role required');
      return projectAssignmentsApi.addToProject(Number(projectId), {
        employeeId: empSearch.selectedEmp.id,
        role,
        status: 'active',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-assignments', projectId] });
      toast.success('Team member assigned');
      setShowForm(false); setRole(''); empSearch.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to assign'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => projectAssignmentsApi.deleteAssignment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-assignments', projectId] }),
    onError: () => toast.error('Could not remove'),
  });

  return (
    <div className="pjc-crew-group">
      <div className="pjc-crew-group-header pjc-crew-group-header--office">
        <span>Management / Office</span>
      </div>

      {assignments.length > 0 && (
        <table className="pjc-team-table">
          <thead><tr><th>Name</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {assignments.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight: 500 }}>{[a.first_name, a.last_name].filter(Boolean).join(' ') || `Employee #${a.employee_id}`}</td>
                <td>{a.role ?? '—'}</td>
                <td>
                  <button className="pjc-btn-icon" title="Remove" onClick={() => removeMutation.mutate(a.id)}>
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm ? (
        <div className="pjc-nominate-form">
          <div className="pjc-nominate-row">
            <div className="pjc-nominate-field pjc-nominate-field--wide">
              <label className="pjc-field-label">Employee</label>
              <EmpSearchInput
                query={empSearch.empQuery}
                results={empSearch.empResults}
                showDropdown={empSearch.showDropdown}
                onChange={empSearch.setEmpQuery}
                onSelect={e => empSearch.select(e)}
                onClear={empSearch.clearSelection}
              />
            </div>
            <div className="pjc-nominate-field">
              <label className="pjc-field-label">Role</label>
              <select className="pjc-nominate-select" value={role} onChange={e => setRole(e.target.value)}>
                <option value="">— select —</option>
                {MGMT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="pjc-nominate-actions">
            <button className="pjc-btn-ghost" onClick={() => { setShowForm(false); setRole(''); empSearch.reset(); }}>Cancel</button>
            <button className="pjc-btn-save" disabled={!empSearch.selectedEmp || !role || addMutation.isPending}
              onClick={() => addMutation.mutate()}>
              {addMutation.isPending ? 'Saving…' : 'Assign to Team'}
            </button>
          </div>
        </div>
      ) : (
        <button className="pjc-btn-ghost pjc-crew-add-btn" onClick={() => setShowForm(true)}>
          + Add Office / Management
        </button>
      )}
    </div>
  );
};

// ── Field Crew Section ─────────────────────────────────────────────────────────
interface FieldSectionProps { assignments: ProjectAssignment[]; projectId: string }
const FieldSection: React.FC<FieldSectionProps> = ({ assignments, projectId }) => {
  const { toast } = useTitanFeedback();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [role, setRole] = useState('');
  const [trade, setTrade] = useState('');
  const [notes, setNotes] = useState('');
  const empSearch = useEmpSearch();

  const STATUS_LABEL: Record<string, string> = {
    planned: 'Pending Approval',
    active: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };

  const nominateMutation = useMutation({
    mutationFn: () => {
      if (!empSearch.selectedEmp || !role) throw new Error('Employee and role required');
      return projectAssignmentsApi.addToProject(Number(projectId), {
        employeeId: empSearch.selectedEmp.id,
        role,
        trade: trade || undefined,
        notes: notes || undefined,
        status: 'planned',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-assignments', projectId] });
      toast.success('Field nomination submitted — pending labor coordinator approval');
      setShowForm(false); setRole(''); setTrade(''); setNotes(''); empSearch.reset();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to submit'),
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: number) => projectAssignmentsApi.deleteAssignment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-assignments', projectId] });
      toast.success('Nomination withdrawn');
    },
    onError: () => toast.error('Could not withdraw'),
  });

  return (
    <div className="pjc-crew-group">
      <div className="pjc-crew-group-header pjc-crew-group-header--field">
        <span>Field Crew</span>
        <Link to="/labor" className="pjc-link-cta" style={{ fontWeight: 400, fontSize: '0.75rem' }}>
          Manage in Labor module →
        </Link>
      </div>

      {assignments.length === 0 ? (
        <p className="pjc-crew-empty-msg">No field crew nominated yet.</p>
      ) : (
        <table className="pjc-team-table">
          <thead><tr><th>Name</th><th>Role</th><th>Trade</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {assignments.map(a => {
              const isPending = !a.status || a.status === 'planned';
              return (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500 }}>{[a.first_name, a.last_name].filter(Boolean).join(' ') || `Employee #${a.employee_id}`}</td>
                  <td>{a.role ?? '—'}</td>
                  <td>{a.trade ?? '—'}</td>
                  <td>
                    <span className={`pjc-status-badge pjc-status-${a.status ?? 'planned'}`}>
                      {STATUS_LABEL[a.status ?? 'planned'] ?? a.status}
                    </span>
                  </td>
                  <td>
                    {isPending && (
                      <button className="pjc-btn-icon" title="Withdraw" onClick={() => withdrawMutation.mutate(a.id)}>
                        <TrashIcon />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showForm ? (
        <div className="pjc-nominate-form">
          <p className="pjc-nominate-notice pjc-nominate-notice--pending">
            Field nominations are sent to the Labor Coordinator for approval before becoming active.
          </p>
          <div className="pjc-nominate-row">
            <div className="pjc-nominate-field pjc-nominate-field--wide">
              <label className="pjc-field-label">Employee</label>
              <EmpSearchInput
                query={empSearch.empQuery}
                results={empSearch.empResults}
                showDropdown={empSearch.showDropdown}
                onChange={empSearch.setEmpQuery}
                onSelect={e => empSearch.select(e, emp => { if (emp.trade && !trade) setTrade(emp.trade); })}
                onClear={empSearch.clearSelection}
              />
            </div>
            <div className="pjc-nominate-field">
              <label className="pjc-field-label">Role</label>
              <select className="pjc-nominate-select" value={role} onChange={e => setRole(e.target.value)}>
                <option value="">— select —</option>
                {FIELD_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="pjc-nominate-field">
              <label className="pjc-field-label">Trade</label>
              <select className="pjc-nominate-select" value={trade} onChange={e => setTrade(e.target.value)}>
                <option value="">— select —</option>
                {ASSIGNMENT_TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label className="pjc-field-label">Notes for Labor Coordinator (optional)</label>
            <input type="text" className="pjc-nominate-input" value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Start date preference, specific skills needed…" />
          </div>
          <div className="pjc-nominate-actions">
            <button className="pjc-btn-ghost" onClick={() => { setShowForm(false); setRole(''); setTrade(''); setNotes(''); empSearch.reset(); }}>Cancel</button>
            <button className="pjc-btn-save" disabled={!empSearch.selectedEmp || !role || nominateMutation.isPending}
              onClick={() => nominateMutation.mutate()}>
              {nominateMutation.isPending ? 'Submitting…' : 'Submit for Approval →'}
            </button>
          </div>
        </div>
      ) : (
        <button className="pjc-btn-ghost pjc-crew-add-btn" onClick={() => setShowForm(true)}>
          + Nominate Field Crew
        </button>
      )}
    </div>
  );
};

// ── Crew Panel (combines both sections) ───────────────────────────────────────
interface CrewPanelProps { assignments: ProjectAssignment[]; projectId: string; onNominated: () => void }
const CrewPanel: React.FC<CrewPanelProps> = ({ assignments, projectId }) => {
  const officeAssignments = assignments.filter(a =>
    a.role && (MGMT_ROLES as readonly string[]).includes(a.role)
  );
  const fieldAssignments = assignments.filter(a =>
    !a.role || !(MGMT_ROLES as readonly string[]).includes(a.role)
  );

  return (
    <div className="pjc-crew-panel">
      <OfficeSection assignments={officeAssignments} projectId={projectId} />
      <FieldSection assignments={fieldAssignments} projectId={projectId} />
    </div>
  );
};

// ── Other Contacts Table ───────────────────────────────────────────────────────
interface OtherContactsTableProps {
  contacts: OtherContact[];
  onChange: (contacts: OtherContact[]) => void;
}
const OtherContactsTable: React.FC<OtherContactsTableProps> = ({ contacts, onChange }) => {
  const add = () => onChange([...contacts, { id: uid(), role: '', name: '' }]);
  const update = (id: string, field: keyof OtherContact, value: string) =>
    onChange(contacts.map(c => c.id === id ? { ...c, [field]: value } : c));
  const remove = (id: string) => onChange(contacts.filter(c => c.id !== id));

  return (
    <div className="pjc-other-contacts">
      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', margin: '0 0 0.5rem 0', paddingBottom: '0.375rem', borderBottom: '1px solid #e5e7eb' }}>
        Other Contacts
        <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
          (GC super, owner's rep, architect, etc.)
        </span>
      </h3>
      {contacts.length > 0 && (
        <table className="pjc-team-table" style={{ marginBottom: '0.5rem' }}>
          <thead>
            <tr><th style={{ width: '24%' }}>Role</th><th style={{ width: '26%' }}>Name</th><th style={{ width: '22%' }}>Phone</th><th style={{ width: '22%' }}>Email</th><th style={{ width: 32 }}></th></tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id}>
                <td><input type="text" value={c.role} onChange={e => update(c.id, 'role', e.target.value)} placeholder="e.g. GC Superintendent" /></td>
                <td><input type="text" value={c.name} onChange={e => update(c.id, 'name', e.target.value)} placeholder="Full name" /></td>
                <td><input type="text" value={c.phone ?? ''} onChange={e => update(c.id, 'phone', e.target.value)} placeholder="—" /></td>
                <td><input type="text" value={c.email ?? ''} onChange={e => update(c.id, 'email', e.target.value)} placeholder="—" /></td>
                <td><button className="pjc-btn-icon" onClick={() => remove(c.id)} title="Remove"><TrashIcon /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button className="pjc-btn-ghost" onClick={add}>+ Add Contact</button>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

const PreJobChecklistPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useTitanFeedback();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({ project_info: true });

  // Date edit state
  const [editingDates, setEditingDates] = useState(false);
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');

  // ── Queries ──
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(r => r.data),
    enabled: !!projectId,
  });

  const { data: contract } = useQuery({
    queryKey: ['vistaContract', projectId],
    queryFn: () => vistaDataService.getContractByProjectId(Number(projectId)),
    enabled: !!projectId,
  });

  const { data: costSummary } = useQuery({
    queryKey: ['phaseCodeCostSummary', projectId],
    queryFn: () => vistaDataService.getPhaseCodeCostSummary(Number(projectId)),
    enabled: !!projectId,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['project-assignments', projectId],
    queryFn: () => projectAssignmentsApi.getByProject(Number(projectId)),
    enabled: !!projectId,
  });

  const { data: checklist, isLoading } = useQuery({
    queryKey: ['preJobChecklist', projectId],
    queryFn: () => preJobChecklistApi.get(Number(projectId)),
    enabled: !!projectId,
  });

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: ({ section, data }: { section: ChecklistSection; data: any }) =>
      preJobChecklistApi.updateSection(Number(projectId), section, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
      toast.success('Saved');
    },
    onError: () => toast.error('Save failed'),
  });

  const saveDatesMutation = useMutation({
    mutationFn: async (data: { start_date: string; end_date: string }) => {
      // Write to the projects table
      await projectsApi.update(Number(projectId), data);
      // Sync to the Vista contract projection overrides if a contract is linked
      if (contract?.id) {
        await vistaDataService.updateProjectionOverrides(contract.id, {
          user_adjusted_start_date: data.start_date,
          user_adjusted_end_date: data.end_date,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['vistaContract', projectId] });
      setEditingDates(false);
      toast.success('Project dates saved');
    },
    onError: () => toast.error('Failed to save dates'),
  });

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Local draft state ──
  const [projectInfoDraft, setProjectInfoDraft] = useState<PreJobChecklist['project_info'] | null>(null);
  const [laborDraft, setLaborDraft] = useState<PreJobChecklist['labor'] | null>(null);
  const [materialDraft, setMaterialDraft] = useState<PreJobChecklist['material'] | null>(null);
  const [subcontractsDraft, setSubcontractsDraft] = useState<PreJobChecklist['subcontracts'] | null>(null);
  const [rentalDraft, setRentalDraft] = useState<PreJobChecklist['rental'] | null>(null);
  const [mepDraft, setMepDraft] = useState<PreJobChecklist['mep_equipment'] | null>(null);
  const [gcDraft, setGcDraft] = useState<PreJobChecklist['general_conditions'] | null>(null);

  const getProjectInfo = () => projectInfoDraft ?? checklist?.project_info ?? {};
  const getLabor = () => laborDraft ?? checklist?.labor ?? {};
  const getMaterial = () => materialDraft ?? checklist?.material ?? {};
  const getSubcontracts = () => subcontractsDraft ?? checklist?.subcontracts ?? {};
  const getRental = () => rentalDraft ?? checklist?.rental ?? {};
  const getMep = () => mepDraft ?? checklist?.mep_equipment ?? {};
  const getGc = () => gcDraft ?? checklist?.general_conditions ?? {};

  const save = (section: ChecklistSection, data: any) => saveMutation.mutate({ section, data });
  const isSaving = saveMutation.isPending;

  if (isLoading) return <div className="pjc-page"><p>Loading...</p></div>;

  const checklistIsEmpty = !checklist?.project_info?.bid_scope_notes
    && !checklist?.project_info?.special_conditions
    && !checklist?.labor?.approach_notes
    && !checklist?.labor?.trades?.length
    && !checklist?.material?.approach_notes
    && !checklist?.material?.items?.length
    && !checklist?.subcontracts?.items?.length
    && !checklist?.orientation?.directions
    && !checklist?.orientation?.badge_required
    && !checklist?.orientation?.contact_name;

  const WIZARD_STEPS = [
    'Key Dates', 'Schedule', 'Office Team', 'Field Team', 'Orientation', 'Site Conditions', 'Scope & Bid',
    'Labor Plan', 'Material Plan', 'Subcontracts', 'Other Costs', 'Contacts', 'Summary',
  ];
  const wizardKey = `pjc_wizard_step_${projectId}`;
  const savedWizardStep = parseInt(localStorage.getItem(wizardKey) ?? '0', 10);
  const wizardCompleted = savedWizardStep >= WIZARD_STEPS.length;
  const wizardInProgress = savedWizardStep > 0 && savedWizardStep < WIZARD_STEPS.length;

  // ── Date helpers ──
  // Prefer project-level dates; fall back to Vista contract projection overrides
  const startDate = project?.start_date ?? contract?.user_adjusted_start_date ?? null;
  const endDate = project?.end_date ?? contract?.user_adjusted_end_date ?? null;
  const missingDates = !startDate || !endDate;

  const openDateEdit = () => {
    setDraftStartDate(startDate?.slice(0, 10) ?? '');
    setDraftEndDate(endDate?.slice(0, 10) ?? '');
    setEditingDates(true);
  };

  // ── Vista cost type data ──
  const laborTotal = costSummary?.labor_totals;
  const matData = costSummary?.costs?.material;
  const subData = costSummary?.costs?.subcontracts;
  const rentalData = costSummary?.costs?.rentals;
  const mepData = costSummary?.costs?.mep_equipment;
  const gcData = costSummary?.costs?.general_conditions;

  // ── Labor section helpers ──
  const labor = getLabor();
  const laborTrades: LaborTradeRow[] = labor.trades ?? [];
  const defaultLaborTrades = (): LaborTradeRow[] => [
    { id: uid(), trade: 'Pipefitter' },
    { id: uid(), trade: 'Sheet Metal' },
    { id: uid(), trade: 'Plumber' },
    { id: uid(), trade: 'BIM' },
    { id: uid(), trade: 'Engineering' },
    { id: uid(), trade: 'Overhead' },
  ];
  const effectiveLaborTrades = laborTrades.length > 0 ? laborTrades : defaultLaborTrades();

  const updateLaborTrade = (id: string, field: keyof LaborTradeRow, value: any) =>
    setLaborDraft({ ...labor, trades: effectiveLaborTrades.map(t => t.id === id ? { ...t, [field]: value } : t) });
  const addLaborTrade = () =>
    setLaborDraft({ ...labor, trades: [...effectiveLaborTrades, { id: uid(), trade: '' }] });
  const removeLaborTrade = (id: string) =>
    setLaborDraft({ ...labor, trades: effectiveLaborTrades.filter(t => t.id !== id) });

  // ── Material helpers ──
  const DEFAULT_MATERIAL_ITEMS: MaterialItemRow[] = [
    { id: uid(), description: 'Sheet Metal' },
    { id: uid(), description: 'Piping' },
    { id: uid(), description: 'Plumbing' },
    { id: uid(), description: 'Insulation' },
    { id: uid(), description: 'Controls / BAS' },
  ];
  const material = getMaterial();
  const materialItems: MaterialItemRow[] = material.items?.length ? material.items : DEFAULT_MATERIAL_ITEMS;
  const updateMaterialItem = (id: string, field: keyof MaterialItemRow, value: any) =>
    setMaterialDraft({ ...material, items: materialItems.map(i => i.id === id ? { ...i, [field]: value } : i) });
  const addMaterialItem = () =>
    setMaterialDraft({ ...material, items: [...materialItems, { id: uid(), description: '' }] });
  const removeMaterialItem = (id: string) =>
    setMaterialDraft({ ...material, items: materialItems.filter(i => i.id !== id) });

  // ── Subcontracts helpers ──
  const subs = getSubcontracts();
  const subItems: SubcontractItemRow[] = subs.items ?? [];
  const updateSubItem = (id: string, field: keyof SubcontractItemRow, value: any) =>
    setSubcontractsDraft({ ...subs, items: subItems.map(i => i.id === id ? { ...i, [field]: value } : i) });
  const addSubItem = () =>
    setSubcontractsDraft({ ...subs, items: [...subItems, { id: uid(), description: '' }] });
  const removeSubItem = (id: string) =>
    setSubcontractsDraft({ ...subs, items: subItems.filter(i => i.id !== id) });

  // ── Rental helpers ──
  const rental = getRental();
  const rentalItems: GenericItemRow[] = rental.items ?? [];
  const updateRentalItem = (id: string, field: keyof GenericItemRow, value: any) =>
    setRentalDraft({ ...rental, items: rentalItems.map(i => i.id === id ? { ...i, [field]: value } : i) });
  const addRentalItem = () =>
    setRentalDraft({ ...rental, items: [...rentalItems, { id: uid(), description: '' }] });
  const removeRentalItem = (id: string) =>
    setRentalDraft({ ...rental, items: rentalItems.filter(i => i.id !== id) });

  // ── MEP helpers ──
  const mep = getMep();
  const mepItems: GenericItemRow[] = mep.items ?? [];
  const updateMepItem = (id: string, field: keyof GenericItemRow, value: any) =>
    setMepDraft({ ...mep, items: mepItems.map(i => i.id === id ? { ...i, [field]: value } : i) });
  const addMepItem = () =>
    setMepDraft({ ...mep, items: [...mepItems, { id: uid(), description: '' }] });
  const removeMepItem = (id: string) =>
    setMepDraft({ ...mep, items: mepItems.filter(i => i.id !== id) });

  // ── GC helpers ──
  const gc = getGc();
  const gcItems: GenericItemRow[] = gc.items ?? [];
  const updateGcItem = (id: string, field: keyof GenericItemRow, value: any) =>
    setGcDraft({ ...gc, items: gcItems.map(i => i.id === id ? { ...i, [field]: value } : i) });
  const addGcItem = () =>
    setGcDraft({ ...gc, items: [...gcItems, { id: uid(), description: '' }] });
  const removeGcItem = (id: string) =>
    setGcDraft({ ...gc, items: gcItems.filter(i => i.id !== id) });

  const pi = getProjectInfo();

  return (
    <div className="pjc-page">
      {/* Page header */}
      <div className="pjc-header">
        <div className="pjc-title-block">
          <h1>Pre-Job Checklist</h1>
          {project && (
            <p className="pjc-subtitle">
              {project.name}{project.number ? ` · ${project.number}` : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate(`/projects/${projectId}/pre-job-checklist/wizard`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: (checklistIsEmpty || wizardInProgress) ? 'linear-gradient(135deg, #002356, #003580)' : '#f1f5f9',
            color: (checklistIsEmpty || wizardInProgress) ? 'white' : '#475569',
            border: 'none', borderRadius: 8,
            padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 700,
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '1rem' }}>🚀</span>
          {wizardInProgress ? `Continue Setup (Step ${savedWizardStep} of ${WIZARD_STEPS.length})` : checklistIsEmpty ? 'Start Guided Setup' : wizardCompleted ? 'Revisit Guided Setup' : 'Re-run Guided Setup'}
        </button>
      </div>

      {/* Titan wizard banner */}
      {(wizardInProgress || wizardCompleted || checklistIsEmpty) && (
        <div style={{
          margin: '0 0 1.5rem',
          background: wizardCompleted && !checklistIsEmpty
            ? 'linear-gradient(135deg, #14532d 0%, #166534 100%)'
            : 'linear-gradient(135deg, #002356 0%, #003580 100%)',
          borderRadius: 12, padding: '1.25rem 1.5rem',
          display: 'flex', gap: '1rem', alignItems: 'flex-start',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, color: 'white', fontSize: '1.1rem', flexShrink: 0,
          }}>T</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#93c5fd', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Titan</div>
            {wizardCompleted && !checklistIsEmpty ? (
              <>
                <div style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem', marginBottom: 6 }}>
                  ✓ Guided setup complete — your checklist is populated and ready.
                </div>
                <div style={{ color: '#86efac', fontSize: '0.82rem', marginBottom: 12 }}>
                  All 13 steps finished. Review each section below or revisit the wizard any time to update your plan.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {WIZARD_STEPS.map(label => (
                    <span key={label} style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#16a34a', color: 'white' }}>
                      ✓ {label}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => navigate(`/projects/${projectId}/pre-job-checklist/wizard`)}
                  style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 7, padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Revisit Guided Setup
                </button>
              </>
            ) : wizardInProgress ? (
              <>
                <div style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem', marginBottom: 6 }}>
                  You're {Math.round((savedWizardStep / WIZARD_STEPS.length) * 100)}% through the guided setup — pick up where you left off.
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 99, height: 6, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ background: '#f97316', height: '100%', borderRadius: 99, width: `${Math.round((savedWizardStep / WIZARD_STEPS.length) * 100)}%`, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {WIZARD_STEPS.map((label, i) => {
                    const num = i + 1;
                    const done = savedWizardStep > num;
                    const current = savedWizardStep === num;
                    return (
                      <span key={label} style={{
                        fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                        background: done ? '#16a34a' : current ? '#f97316' : 'rgba(255,255,255,0.1)',
                        color: done || current ? 'white' : '#93c5fd',
                      }}>
                        {done ? '✓ ' : current ? '→ ' : ''}{label}
                      </span>
                    );
                  })}
                </div>
                <button
                  onClick={() => navigate(`/projects/${projectId}/pre-job-checklist/wizard`)}
                  style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 7, padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Continue Guided Setup →
                </button>
              </>
            ) : (
              <>
                <div style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem', marginBottom: 6 }}>
                  This checklist is empty. Want me to walk you through it?
                </div>
                <div style={{ color: '#93c5fd', fontSize: '0.8rem', marginBottom: 12 }}>
                  I'll guide you through key dates, project team, scope notes, and each cost type plan — step by step. Takes about 10–15 minutes.
                </div>
                <button
                  onClick={() => navigate(`/projects/${projectId}/pre-job-checklist/wizard`)}
                  style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 7, padding: '0.5rem 1.25rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Start Guided Setup →
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Missing dates banner ── */}
      {missingDates && !editingDates && (
        <div className="pjc-dates-banner">
          <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 18, height: 18, flexShrink: 0 }}>
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <div>
            <strong>Project start/finish dates not entered.</strong> These are required to calculate the labor forecast
            and project schedule. Please enter them below.
          </div>
          <button className="pjc-btn-save" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={openDateEdit}>
            Enter Dates
          </button>
        </div>
      )}

      {/* ── Inline date editor ── */}
      {editingDates && (
        <div className="pjc-date-editor">
          <h3>Set Project Dates</h3>
          <div className="pjc-date-editor-fields">
            <div>
              <label className="pjc-field-label">Start Date</label>
              <input type="date" className="pjc-date-input" value={draftStartDate}
                onChange={e => setDraftStartDate(e.target.value)} />
            </div>
            <div>
              <label className="pjc-field-label">Estimated Completion Date</label>
              <input type="date" className="pjc-date-input" value={draftEndDate}
                onChange={e => setDraftEndDate(e.target.value)} />
            </div>
          </div>
          <div className="pjc-date-editor-actions">
            <button className="pjc-btn-ghost" onClick={() => setEditingDates(false)}>Cancel</button>
            <button
              className="pjc-btn-save"
              disabled={!draftStartDate || !draftEndDate || saveDatesMutation.isPending}
              onClick={() => saveDatesMutation.mutate({ start_date: draftStartDate, end_date: draftEndDate })}
            >
              {saveDatesMutation.isPending ? 'Saving…' : 'Save Dates'}
            </button>
          </div>
        </div>
      )}

      {/* ── PROJECT INFORMATION ── */}
      <div className="pjc-info-card">
        <div className="pjc-info-card-header" onClick={() => toggle('project_info')} style={{ cursor: 'pointer' }}>
          <Chevron open={!!expanded.project_info} />
          <h2>Project Information Sheet</h2>
        </div>

        {expanded.project_info && (
          <div className="pjc-info-body">
            <div className="pjc-info-grid">
              {/* Left: project facts */}
              <div>
                <div className="pjc-vista-facts">
                  <div className="pjc-fact-row">
                    <span className="pjc-fact-label">Job Name</span>
                    <span className="pjc-fact-value">{contract?.description ?? project?.name ?? '—'}</span>
                  </div>
                  <div className="pjc-fact-row">
                    <span className="pjc-fact-label">Customer / Owner</span>
                    <span className="pjc-fact-value">{contract?.customer_name ?? project?.client ?? '—'}</span>
                  </div>
                  <div className="pjc-fact-row">
                    <span className="pjc-fact-label">Location</span>
                    <span className="pjc-fact-value">
                      {[contract?.ship_city, contract?.ship_state].filter(Boolean).join(', ') ||
                        [project?.ship_city, project?.ship_state].filter(Boolean).join(', ') ||
                        project?.address || '—'}
                    </span>
                  </div>
                  <div className="pjc-fact-row">
                    <span className="pjc-fact-label">Contract Value</span>
                    <span className="pjc-fact-value">{fmt(contract?.contract_amount ?? project?.contract_value)}</span>
                  </div>
                  <div className="pjc-fact-row">
                    <span className="pjc-fact-label">Project Manager</span>
                    <span className="pjc-fact-value">{contract?.project_manager_name ?? project?.manager_name ?? '—'}</span>
                  </div>
                  <div className="pjc-fact-row">
                    <span className="pjc-fact-label">Start Date</span>
                    <span className="pjc-fact-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {startDate ? fmtDate(startDate) : <span style={{ color: '#ef4444', fontStyle: 'italic' }}>Not set</span>}
                      <button className="pjc-btn-edit-date" onClick={openDateEdit} title="Edit dates">✎</button>
                    </span>
                  </div>
                  <div className="pjc-fact-row">
                    <span className="pjc-fact-label">Est. Completion</span>
                    <span className="pjc-fact-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {endDate ? fmtDate(endDate) : <span style={{ color: '#ef4444', fontStyle: 'italic' }}>Not set</span>}
                    </span>
                  </div>
                  <div className="pjc-fact-row">
                    <span className="pjc-fact-label">Market</span>
                    <span className="pjc-fact-value">{contract?.primary_market ?? project?.market ?? '—'}</span>
                  </div>
                  <div className="pjc-fact-row">
                    <span className="pjc-fact-label">Contract #</span>
                    <span className="pjc-fact-value">{contract?.contract_number ?? '—'}</span>
                  </div>
                </div>
              </div>

              {/* Right: Project Team — nominations + other contacts */}
              <div className="pjc-team-section">
                <h3>
                  Project Team
                  <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                    (nominations → Labor module)
                  </span>
                </h3>
                <CrewPanel
                  assignments={assignments}
                  projectId={projectId!}
                  onNominated={() => {}}
                />
                <OtherContactsTable
                  contacts={pi.other_contacts ?? []}
                  onChange={list => setProjectInfoDraft({ ...pi, other_contacts: list })}
                />
              </div>
            </div>

            {/* Notes row */}
            <div className="pjc-notes-row">
              <div>
                <label className="pjc-field-label">Bid / Scope Notes</label>
                <textarea
                  className="pjc-textarea"
                  value={pi.bid_scope_notes ?? ''}
                  onChange={e => setProjectInfoDraft({ ...pi, bid_scope_notes: e.target.value })}
                  placeholder="Key scope inclusions/exclusions, bid assumptions..."
                />
              </div>
              <div>
                <label className="pjc-field-label">Special Conditions / Risks</label>
                <textarea
                  className="pjc-textarea"
                  value={pi.special_conditions ?? ''}
                  onChange={e => setProjectInfoDraft({ ...pi, special_conditions: e.target.value })}
                  placeholder="Site access restrictions, phasing requirements, union rules..."
                />
              </div>
            </div>

            <div className="pjc-section-actions">
              <button className="pjc-btn-save" disabled={isSaving}
                onClick={() => { save('project_info', getProjectInfo()); setProjectInfoDraft(null); }}>
                {isSaving ? 'Saving…' : 'Save Notes'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── COST TYPE SECTIONS ── */}
      <div className="pjc-sections">

        {/* ── 1. LABOR ── */}
        <div className={`pjc-section ${expanded.labor ? 'expanded' : ''}`}>
          <div className="pjc-section-header" onClick={() => toggle('labor')}>
            <Chevron open={!!expanded.labor} />
            <div className="pjc-section-title">
              <h3>Labor</h3>
              <span className="pjc-cost-type-label">Cost Type 1</span>
            </div>
            <div className="pjc-section-kpis">
              <div className="pjc-kpi">
                <span className="pjc-kpi-label">Est Hrs</span>
                <span className="pjc-kpi-value">{laborTotal ? laborTotal.est_hours.toLocaleString() : '—'}</span>
              </div>
              <div className="pjc-kpi">
                <span className="pjc-kpi-label">JTD Hrs</span>
                <span className="pjc-kpi-value">{laborTotal ? laborTotal.jtd_hours.toLocaleString() : '—'}</span>
              </div>
              <div className="pjc-kpi">
                <span className="pjc-kpi-label">Est Cost</span>
                <span className="pjc-kpi-value">{fmt(laborTotal?.est_cost)}</span>
              </div>
              <div className="pjc-kpi">
                <span className="pjc-kpi-label">Projected</span>
                <span className="pjc-kpi-value">{fmt(laborTotal?.projected_cost)}</span>
              </div>
            </div>
          </div>

          {expanded.labor && (
            <div className="pjc-section-body">

              {/* Vista phase code labor detail */}
              <div className="pjc-vista-block">
                <p className="pjc-vista-block-title">
                  Vista Phase Code Labor <span className="pjc-vista-badge">LIVE</span>
                </p>
                {costSummary ? (
                  <VistaLaborTable costSummary={costSummary} />
                ) : (
                  <p className="pjc-vista-no-data">No Vista contract linked to this project.</p>
                )}
              </div>

              {/* Labor Forecast Summary */}
              {contract ? (
                <div className="pjc-vista-block" style={{ marginTop: '0' }}>
                  <p className="pjc-vista-block-title">
                    Labor Forecast <span className="pjc-vista-badge">LIVE</span>
                    {missingDates && (
                      <span style={{ marginLeft: '0.5rem', color: '#f59e0b', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
                        — enter project dates above to see monthly calculations
                      </span>
                    )}
                  </p>
                  <LaborForecastSummary
                    contract={contract}
                    costSummary={costSummary}
                    startDate={startDate}
                    endDate={endDate}
                    projectId={projectId!}
                  />
                </div>
              ) : (
                <div className="pjc-no-vista">No Vista contract linked — labor forecast unavailable.</div>
              )}

              {/* PM Labor Plan */}
              <div className="pjc-pm-block">
                <div className="pjc-pm-block-header"><span>PM Goal Plan — Labor</span></div>
                <div className="pjc-pm-block-body">
                  <div>
                    <label className="pjc-field-label">Approach / Strategy</label>
                    <textarea
                      className="pjc-textarea"
                      value={labor.approach_notes ?? ''}
                      onChange={e => setLaborDraft({ ...labor, approach_notes: e.target.value })}
                      placeholder="Overall labor execution strategy, crew plan, sequencing approach, peak workforce needs..."
                    />
                  </div>
                  <div>
                    <label className="pjc-field-label">Hour & Rate Goals by Trade</label>
                    <table className="pjc-detail-table">
                      <thead>
                        <tr>
                          <th style={{ width: '30%' }}>Trade / Category</th>
                          <th className="right" style={{ width: '18%' }}>Goal Hours</th>
                          <th className="right" style={{ width: '18%' }}>Target Rate ($/hr)</th>
                          <th style={{ width: '28%' }}>Notes</th>
                          <th style={{ width: 32 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {effectiveLaborTrades.map(t => (
                          <tr key={t.id}>
                            <td><input type="text" value={t.trade} onChange={e => updateLaborTrade(t.id, 'trade', e.target.value)} placeholder="Trade name" /></td>
                            <td><input type="number" value={t.goal_hours ?? ''} onChange={e => updateLaborTrade(t.id, 'goal_hours', e.target.value ? Number(e.target.value) : undefined)} placeholder="0" /></td>
                            <td><input type="number" value={t.target_rate ?? ''} onChange={e => updateLaborTrade(t.id, 'target_rate', e.target.value ? Number(e.target.value) : undefined)} placeholder="0.00" /></td>
                            <td><input type="text" value={t.notes ?? ''} onChange={e => updateLaborTrade(t.id, 'notes', e.target.value)} placeholder="Notes..." /></td>
                            <td><button className="pjc-btn-icon" onClick={() => removeLaborTrade(t.id)} title="Remove"><TrashIcon /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="pjc-add-row-bar">
                      <button className="pjc-btn-ghost" onClick={addLaborTrade}>+ Add Row</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pjc-section-actions">
                <button className="pjc-btn-save" disabled={isSaving}
                  onClick={() => { save('labor', { ...labor, trades: effectiveLaborTrades }); setLaborDraft(null); }}>
                  {isSaving ? 'Saving…' : 'Save Labor Plan'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 2. MATERIAL ── */}
        <div className={`pjc-section ${expanded.material ? 'expanded' : ''}`}>
          <div className="pjc-section-header" onClick={() => toggle('material')}>
            <Chevron open={!!expanded.material} />
            <div className="pjc-section-title">
              <h3>Material</h3>
              <span className="pjc-cost-type-label">Cost Type 2</span>
            </div>
            <div className="pjc-section-kpis">
              <div className="pjc-kpi"><span className="pjc-kpi-label">Estimated</span><span className="pjc-kpi-value">{fmt(matData?.est_cost)}</span></div>
              <div className="pjc-kpi"><span className="pjc-kpi-label">JTD</span><span className="pjc-kpi-value">{fmt(matData?.jtd_cost)}</span></div>
              <div className="pjc-kpi"><span className="pjc-kpi-label">Projected</span><span className="pjc-kpi-value">{fmt(matData?.projected_cost)}</span></div>
            </div>
          </div>

          {expanded.material && (
            <div className="pjc-section-body">
              <div className="pjc-vista-block">
                <p className="pjc-vista-block-title">Vista Material Summary <span className="pjc-vista-badge">LIVE</span></p>
                {matData ? (
                  <table className="pjc-vista-table">
                    <thead><tr><th>Category</th><th>Estimated</th><th>JTD</th><th>Committed</th><th>Projected</th></tr></thead>
                    <tbody><VistaCostRow label="Material (CT2)" data={matData} /></tbody>
                  </table>
                ) : <p className="pjc-vista-no-data">No Vista material data.</p>}
              </div>

              <div className="pjc-pm-block">
                <div className="pjc-pm-block-header"><span>PM Goal Plan — Material</span></div>
                <div className="pjc-pm-block-body">
                  <div>
                    <label className="pjc-field-label">Procurement Approach</label>
                    <textarea className="pjc-textarea" value={material.approach_notes ?? ''}
                      onChange={e => setMaterialDraft({ ...material, approach_notes: e.target.value })}
                      placeholder="Procurement strategy, key vendors, early release items, budget targets..." />
                  </div>
                  <div>
                    <label className="pjc-field-label">Material Breakdown by Category</label>
                    <table className="pjc-detail-table">
                      <thead>
                        <tr>
                          <th style={{ width: '28%' }}>Category</th>
                          <th className="right" style={{ width: '16%' }}>Budget</th>
                          <th style={{ width: '20%' }}>Key Vendor</th>
                          <th style={{ width: '14%' }}>Lead Time</th>
                          <th style={{ width: '16%' }}>Notes</th>
                          <th style={{ width: 32 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialItems.map(i => (
                          <tr key={i.id}>
                            <td><input type="text" value={i.description} onChange={e => updateMaterialItem(i.id, 'description', e.target.value)} placeholder="Category" /></td>
                            <td><input type="number" value={i.budget ?? ''} onChange={e => updateMaterialItem(i.id, 'budget', e.target.value ? Number(e.target.value) : undefined)} placeholder="$0" /></td>
                            <td><input type="text" value={i.vendor ?? ''} onChange={e => updateMaterialItem(i.id, 'vendor', e.target.value)} placeholder="Vendor" /></td>
                            <td><input type="text" value={i.lead_time ?? ''} onChange={e => updateMaterialItem(i.id, 'lead_time', e.target.value)} placeholder="e.g. 8 wks" /></td>
                            <td><input type="text" value={i.notes ?? ''} onChange={e => updateMaterialItem(i.id, 'notes', e.target.value)} placeholder="Notes" /></td>
                            <td><button className="pjc-btn-icon" onClick={() => removeMaterialItem(i.id)} title="Remove"><TrashIcon /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="pjc-add-row-bar"><button className="pjc-btn-ghost" onClick={addMaterialItem}>+ Add Row</button></div>
                  </div>
                </div>
              </div>

              <div className="pjc-section-actions">
                <button className="pjc-btn-save" disabled={isSaving}
                  onClick={() => { save('material', { ...material, items: materialItems }); setMaterialDraft(null); }}>
                  {isSaving ? 'Saving…' : 'Save Material Plan'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. SUBCONTRACTS ── */}
        <div className={`pjc-section ${expanded.subcontracts ? 'expanded' : ''}`}>
          <div className="pjc-section-header" onClick={() => toggle('subcontracts')}>
            <Chevron open={!!expanded.subcontracts} />
            <div className="pjc-section-title">
              <h3>Subcontracts</h3>
              <span className="pjc-cost-type-label">Cost Type 3</span>
            </div>
            <div className="pjc-section-kpis">
              <div className="pjc-kpi"><span className="pjc-kpi-label">Estimated</span><span className="pjc-kpi-value">{fmt(subData?.est_cost)}</span></div>
              <div className="pjc-kpi"><span className="pjc-kpi-label">JTD</span><span className="pjc-kpi-value">{fmt(subData?.jtd_cost)}</span></div>
              <div className="pjc-kpi"><span className="pjc-kpi-label">Projected</span><span className="pjc-kpi-value">{fmt(subData?.projected_cost)}</span></div>
            </div>
          </div>

          {expanded.subcontracts && (
            <div className="pjc-section-body">
              <div className="pjc-vista-block">
                <p className="pjc-vista-block-title">Vista Subcontract Summary <span className="pjc-vista-badge">LIVE</span></p>
                {subData ? (
                  <table className="pjc-vista-table">
                    <thead><tr><th>Category</th><th>Estimated</th><th>JTD</th><th>Committed</th><th>Projected</th></tr></thead>
                    <tbody><VistaCostRow label="Subcontracts (CT3)" data={subData} /></tbody>
                  </table>
                ) : <p className="pjc-vista-no-data">No Vista subcontract data.</p>}
              </div>

              <div className="pjc-pm-block">
                <div className="pjc-pm-block-header"><span>PM Goal Plan — Subcontracts</span></div>
                <div className="pjc-pm-block-body">
                  <div>
                    <label className="pjc-field-label">Subcontract Strategy</label>
                    <textarea className="pjc-textarea" value={subs.approach_notes ?? ''}
                      onChange={e => setSubcontractsDraft({ ...subs, approach_notes: e.target.value })}
                      placeholder="Bid strategy, preferred subs, scope breakdown plan, key concerns..." />
                  </div>
                  <div>
                    <label className="pjc-field-label">Subcontractor List</label>
                    <table className="pjc-detail-table">
                      <thead>
                        <tr>
                          <th style={{ width: '28%' }}>Scope</th>
                          <th style={{ width: '24%' }}>Subcontractor</th>
                          <th className="right" style={{ width: '14%' }}>Budget</th>
                          <th style={{ width: '28%' }}>Notes</th>
                          <th style={{ width: 32 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {subItems.map(i => (
                          <tr key={i.id}>
                            <td><input type="text" value={i.description} onChange={e => updateSubItem(i.id, 'description', e.target.value)} placeholder="Scope of work" /></td>
                            <td><input type="text" value={i.subcontractor ?? ''} onChange={e => updateSubItem(i.id, 'subcontractor', e.target.value)} placeholder="Company name" /></td>
                            <td><input type="number" value={i.budget ?? ''} onChange={e => updateSubItem(i.id, 'budget', e.target.value ? Number(e.target.value) : undefined)} placeholder="$0" /></td>
                            <td><input type="text" value={i.notes ?? ''} onChange={e => updateSubItem(i.id, 'notes', e.target.value)} placeholder="Notes" /></td>
                            <td><button className="pjc-btn-icon" onClick={() => removeSubItem(i.id)} title="Remove"><TrashIcon /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="pjc-add-row-bar"><button className="pjc-btn-ghost" onClick={addSubItem}>+ Add Subcontractor</button></div>
                  </div>
                </div>
              </div>

              <div className="pjc-section-actions">
                <button className="pjc-btn-save" disabled={isSaving}
                  onClick={() => { save('subcontracts', { ...subs, items: subItems }); setSubcontractsDraft(null); }}>
                  {isSaving ? 'Saving…' : 'Save Subcontracts Plan'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 4. RENTAL ── */}
        <div className={`pjc-section ${expanded.rental ? 'expanded' : ''}`}>
          <div className="pjc-section-header" onClick={() => toggle('rental')}>
            <Chevron open={!!expanded.rental} />
            <div className="pjc-section-title">
              <h3>Rental</h3>
              <span className="pjc-cost-type-label">Cost Type 4</span>
            </div>
            <div className="pjc-section-kpis">
              <div className="pjc-kpi"><span className="pjc-kpi-label">Estimated</span><span className="pjc-kpi-value">{fmt(rentalData?.est_cost)}</span></div>
              <div className="pjc-kpi"><span className="pjc-kpi-label">JTD</span><span className="pjc-kpi-value">{fmt(rentalData?.jtd_cost)}</span></div>
              <div className="pjc-kpi"><span className="pjc-kpi-label">Projected</span><span className="pjc-kpi-value">{fmt(rentalData?.projected_cost)}</span></div>
            </div>
          </div>

          {expanded.rental && (
            <div className="pjc-section-body">
              <div className="pjc-vista-block">
                <p className="pjc-vista-block-title">Vista Rental Summary <span className="pjc-vista-badge">LIVE</span></p>
                {rentalData ? (
                  <table className="pjc-vista-table">
                    <thead><tr><th>Category</th><th>Estimated</th><th>JTD</th><th>Committed</th><th>Projected</th></tr></thead>
                    <tbody><VistaCostRow label="Rental (CT4)" data={rentalData} /></tbody>
                  </table>
                ) : <p className="pjc-vista-no-data">No Vista rental data.</p>}
              </div>
              <div className="pjc-pm-block">
                <div className="pjc-pm-block-header"><span>PM Goal Plan — Rental Equipment</span></div>
                <div className="pjc-pm-block-body">
                  <div>
                    <label className="pjc-field-label">Rental Strategy</label>
                    <textarea className="pjc-textarea" value={rental.approach_notes ?? ''}
                      onChange={e => setRentalDraft({ ...rental, approach_notes: e.target.value })}
                      placeholder="Key equipment needs, rental durations, preferred vendors, ownership vs. rental decisions..." />
                  </div>
                  <div>
                    <label className="pjc-field-label">Rental Equipment List</label>
                    <table className="pjc-detail-table">
                      <thead><tr><th style={{ width: '50%' }}>Equipment / Description</th><th className="right" style={{ width: '20%' }}>Budget</th><th style={{ width: '24%' }}>Notes</th><th style={{ width: 32 }}></th></tr></thead>
                      <tbody>
                        {rentalItems.map(i => (
                          <tr key={i.id}>
                            <td><input type="text" value={i.description} onChange={e => updateRentalItem(i.id, 'description', e.target.value)} placeholder="Equipment name" /></td>
                            <td><input type="number" value={i.budget ?? ''} onChange={e => updateRentalItem(i.id, 'budget', e.target.value ? Number(e.target.value) : undefined)} placeholder="$0" /></td>
                            <td><input type="text" value={i.notes ?? ''} onChange={e => updateRentalItem(i.id, 'notes', e.target.value)} placeholder="Notes" /></td>
                            <td><button className="pjc-btn-icon" onClick={() => removeRentalItem(i.id)} title="Remove"><TrashIcon /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="pjc-add-row-bar"><button className="pjc-btn-ghost" onClick={addRentalItem}>+ Add Equipment</button></div>
                  </div>
                </div>
              </div>
              <div className="pjc-section-actions">
                <button className="pjc-btn-save" disabled={isSaving}
                  onClick={() => { save('rental', { ...rental, items: rentalItems }); setRentalDraft(null); }}>
                  {isSaving ? 'Saving…' : 'Save Rental Plan'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 5. MEP EQUIPMENT ── */}
        <div className={`pjc-section ${expanded.mep_equipment ? 'expanded' : ''}`}>
          <div className="pjc-section-header" onClick={() => toggle('mep_equipment')}>
            <Chevron open={!!expanded.mep_equipment} />
            <div className="pjc-section-title">
              <h3>MEP Equipment</h3>
              <span className="pjc-cost-type-label">Cost Type 5</span>
            </div>
            <div className="pjc-section-kpis">
              <div className="pjc-kpi"><span className="pjc-kpi-label">Estimated</span><span className="pjc-kpi-value">{fmt(mepData?.est_cost)}</span></div>
              <div className="pjc-kpi"><span className="pjc-kpi-label">JTD</span><span className="pjc-kpi-value">{fmt(mepData?.jtd_cost)}</span></div>
              <div className="pjc-kpi"><span className="pjc-kpi-label">Projected</span><span className="pjc-kpi-value">{fmt(mepData?.projected_cost)}</span></div>
            </div>
          </div>

          {expanded.mep_equipment && (
            <div className="pjc-section-body">
              <div className="pjc-vista-block">
                <p className="pjc-vista-block-title">Vista MEP Equipment Summary <span className="pjc-vista-badge">LIVE</span></p>
                {mepData ? (
                  <table className="pjc-vista-table">
                    <thead><tr><th>Category</th><th>Estimated</th><th>JTD</th><th>Committed</th><th>Projected</th></tr></thead>
                    <tbody><VistaCostRow label="MEP Equipment (CT5)" data={mepData} /></tbody>
                  </table>
                ) : <p className="pjc-vista-no-data">No Vista MEP equipment data.</p>}
              </div>
              <div className="pjc-pm-block">
                <div className="pjc-pm-block-header"><span>PM Goal Plan — MEP Equipment</span></div>
                <div className="pjc-pm-block-body">
                  <div>
                    <label className="pjc-field-label">Procurement Strategy</label>
                    <textarea className="pjc-textarea" value={mep.approach_notes ?? ''}
                      onChange={e => setMepDraft({ ...mep, approach_notes: e.target.value })}
                      placeholder="Equipment procurement plan, long lead items, owner-furnished equipment, startup plan..." />
                  </div>
                  <div>
                    <label className="pjc-field-label">Equipment List</label>
                    <table className="pjc-detail-table">
                      <thead><tr><th style={{ width: '50%' }}>Equipment / Description</th><th className="right" style={{ width: '20%' }}>Budget</th><th style={{ width: '24%' }}>Notes</th><th style={{ width: 32 }}></th></tr></thead>
                      <tbody>
                        {mepItems.map(i => (
                          <tr key={i.id}>
                            <td><input type="text" value={i.description} onChange={e => updateMepItem(i.id, 'description', e.target.value)} placeholder="Equipment name" /></td>
                            <td><input type="number" value={i.budget ?? ''} onChange={e => updateMepItem(i.id, 'budget', e.target.value ? Number(e.target.value) : undefined)} placeholder="$0" /></td>
                            <td><input type="text" value={i.notes ?? ''} onChange={e => updateMepItem(i.id, 'notes', e.target.value)} placeholder="Notes" /></td>
                            <td><button className="pjc-btn-icon" onClick={() => removeMepItem(i.id)} title="Remove"><TrashIcon /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="pjc-add-row-bar"><button className="pjc-btn-ghost" onClick={addMepItem}>+ Add Equipment</button></div>
                  </div>
                </div>
              </div>
              <div className="pjc-section-actions">
                <button className="pjc-btn-save" disabled={isSaving}
                  onClick={() => { save('mep_equipment', { ...mep, items: mepItems }); setMepDraft(null); }}>
                  {isSaving ? 'Saving…' : 'Save MEP Plan'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 6. GENERAL CONDITIONS ── */}
        <div className={`pjc-section ${expanded.general_conditions ? 'expanded' : ''}`}>
          <div className="pjc-section-header" onClick={() => toggle('general_conditions')}>
            <Chevron open={!!expanded.general_conditions} />
            <div className="pjc-section-title">
              <h3>General Conditions</h3>
              <span className="pjc-cost-type-label">Cost Type 6</span>
            </div>
            <div className="pjc-section-kpis">
              <div className="pjc-kpi"><span className="pjc-kpi-label">Estimated</span><span className="pjc-kpi-value">{fmt(gcData?.est_cost)}</span></div>
              <div className="pjc-kpi"><span className="pjc-kpi-label">JTD</span><span className="pjc-kpi-value">{fmt(gcData?.jtd_cost)}</span></div>
              <div className="pjc-kpi"><span className="pjc-kpi-label">Projected</span><span className="pjc-kpi-value">{fmt(gcData?.projected_cost)}</span></div>
            </div>
          </div>

          {expanded.general_conditions && (
            <div className="pjc-section-body">
              <div className="pjc-vista-block">
                <p className="pjc-vista-block-title">Vista General Conditions Summary <span className="pjc-vista-badge">LIVE</span></p>
                {gcData ? (
                  <table className="pjc-vista-table">
                    <thead><tr><th>Category</th><th>Estimated</th><th>JTD</th><th>Committed</th><th>Projected</th></tr></thead>
                    <tbody><VistaCostRow label="General Conditions (CT6)" data={gcData} /></tbody>
                  </table>
                ) : <p className="pjc-vista-no-data">No Vista general conditions data.</p>}
              </div>
              <div className="pjc-pm-block">
                <div className="pjc-pm-block-header"><span>PM Goal Plan — General Conditions</span></div>
                <div className="pjc-pm-block-body">
                  <div>
                    <label className="pjc-field-label">General Conditions Strategy</label>
                    <textarea className="pjc-textarea" value={gc.approach_notes ?? ''}
                      onChange={e => setGcDraft({ ...gc, approach_notes: e.target.value })}
                      placeholder="Staffing plan, trailer/office setup, safety plan, site logistics, temporary utilities..." />
                  </div>
                  <div>
                    <label className="pjc-field-label">General Conditions Items</label>
                    <table className="pjc-detail-table">
                      <thead><tr><th style={{ width: '50%' }}>Item / Description</th><th className="right" style={{ width: '20%' }}>Budget</th><th style={{ width: '24%' }}>Notes</th><th style={{ width: 32 }}></th></tr></thead>
                      <tbody>
                        {gcItems.map(i => (
                          <tr key={i.id}>
                            <td><input type="text" value={i.description} onChange={e => updateGcItem(i.id, 'description', e.target.value)} placeholder="Description" /></td>
                            <td><input type="number" value={i.budget ?? ''} onChange={e => updateGcItem(i.id, 'budget', e.target.value ? Number(e.target.value) : undefined)} placeholder="$0" /></td>
                            <td><input type="text" value={i.notes ?? ''} onChange={e => updateGcItem(i.id, 'notes', e.target.value)} placeholder="Notes" /></td>
                            <td><button className="pjc-btn-icon" onClick={() => removeGcItem(i.id)} title="Remove"><TrashIcon /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="pjc-add-row-bar"><button className="pjc-btn-ghost" onClick={addGcItem}>+ Add Item</button></div>
                  </div>
                </div>
              </div>
              <div className="pjc-section-actions">
                <button className="pjc-btn-save" disabled={isSaving}
                  onClick={() => { save('general_conditions', { ...gc, items: gcItems }); setGcDraft(null); }}>
                  {isSaving ? 'Saving…' : 'Save GC Plan'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PreJobChecklistPage;
