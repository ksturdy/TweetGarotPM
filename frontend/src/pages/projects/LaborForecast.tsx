import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vistaDataService, VPContract } from '../../services/vistaData';
import { format, addMonths, startOfMonth } from 'date-fns';

// ─── Helpers ───────────────────────────────────────────────

const parseNum = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
};

const fmtHours = (value: number): string => {
  if (value === 0) return '-';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
};

const fmtHeadcount = (hours: number, hrsPerPerson: number): string => {
  if (hours === 0) return '-';
  const hc = hours / hrsPerPerson;
  if (hc < 0.1) return '-';
  return hc.toFixed(1);
};

// ─── Contour types ─────────────────────────────────────────

type ContourType = 'flat' | 'front' | 'back' | 'bell' | 'turtle' | 'double' | 'early' | 'late' | 'scurve' | 'rampup' | 'rampdown';

const contourOptions: { value: ContourType; label: string; icon: string }[] = [
  { value: 'flat', label: 'Flat', icon: '▬' },
  { value: 'front', label: 'Front', icon: '▼' },
  { value: 'back', label: 'Back', icon: '▲' },
  { value: 'bell', label: 'Bell', icon: '◆' },
  { value: 'turtle', label: 'Turtle', icon: '◈' },
  { value: 'double', label: 'Double', icon: '⋈' },
  { value: 'early', label: 'Early Pk', icon: '◣' },
  { value: 'late', label: 'Late Pk', icon: '◢' },
  { value: 'scurve', label: 'S-Curve', icon: '∫' },
  { value: 'rampup', label: 'Ramp Up', icon: '⟋' },
  { value: 'rampdown', label: 'Ramp Dn', icon: '⟍' },
];

const getContourMultipliers = (months: number, contour: ContourType): number[] => {
  const multipliers: number[] = [];
  for (let i = 0; i < months; i++) {
    const position = months > 1 ? i / (months - 1) : 0.5;
    let weight: number;
    switch (contour) {
      case 'front': weight = 2 - position * 1.5; break;
      case 'back': weight = 0.5 + position * 1.5; break;
      case 'bell': weight = Math.exp(-Math.pow((position - 0.5) * 3, 2)) * 1.5 + 0.5; break;
      case 'turtle': weight = Math.exp(-Math.pow((position - 0.5) * 2, 2)) * 0.8 + 0.6; break;
      case 'double': {
        const p1 = Math.exp(-Math.pow((position - 0.25) * 5, 2));
        const p2 = Math.exp(-Math.pow((position - 0.75) * 5, 2));
        weight = (p1 + p2) * 0.8 + 0.4;
        break;
      }
      case 'early': weight = Math.exp(-Math.pow((position - 0.2) * 4, 2)) * 1.8 + 0.2; break;
      case 'late': weight = Math.exp(-Math.pow((position - 0.8) * 4, 2)) * 1.8 + 0.2; break;
      case 'scurve': weight = Math.exp(-Math.pow((position - 0.5) * 2.5, 2)) * 1.2 + 0.4; break;
      case 'rampup': weight = 0.1 + position * 1.9; break;
      case 'rampdown': weight = 2 - position * 1.9; break;
      case 'flat': default: weight = 1; break;
    }
    multipliers.push(weight);
  }
  const sum = multipliers.reduce((a, b) => a + b, 0);
  return multipliers.map(w => (w / sum) * months);
};

const getDefaultContour = (pctComplete: number): ContourType => {
  if (pctComplete < 15) return 'scurve';
  if (pctComplete < 40) return 'bell';
  if (pctComplete < 70) return 'back';
  if (pctComplete < 90) return 'rampdown';
  return 'flat';
};

const ContourVisual: React.FC<{ contour: ContourType }> = ({ contour }) => {
  const points: string = (() => {
    switch (contour) {
      case 'flat': return '0,8 24,8';
      case 'front': return '0,2 24,14';
      case 'back': return '0,14 24,2';
      case 'bell': return '0,14 6,10 12,2 18,10 24,14';
      case 'turtle': return '0,12 4,10 8,6 12,5 16,6 20,10 24,12';
      case 'double': return '0,12 4,6 8,10 12,14 16,10 20,6 24,12';
      case 'early': return '0,10 4,2 8,6 12,10 18,12 24,14';
      case 'late': return '0,14 6,12 12,10 16,6 20,2 24,10';
      case 'scurve': return '0,13 4,12 8,8 12,4 16,4 20,8 24,13';
      case 'rampup': return '0,14 24,2';
      case 'rampdown': return '0,2 24,14';
      default: return '0,8 24,8';
    }
  })();
  return (
    <svg width="24" height="16" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
      <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ─── Duration rules ────────────────────────────────────────

interface DurationRule {
  minValue: number;
  maxValue: number;
  months: number;
  label: string;
}

const defaultDurationRules: DurationRule[] = [
  { minValue: 0, maxValue: 500000, months: 3, label: '$0 - $500K' },
  { minValue: 500000, maxValue: 2000000, months: 6, label: '$500K - $2M' },
  { minValue: 2000000, maxValue: 5000000, months: 8, label: '$2M - $5M' },
  { minValue: 5000000, maxValue: 10000000, months: 12, label: '$5M - $10M' },
  { minValue: 10000000, maxValue: Infinity, months: 24, label: '$10M+' },
];

// ─── Trade definitions ─────────────────────────────────────

type TradeName = 'pf' | 'sm' | 'pl';

interface TradeInfo {
  key: TradeName;
  label: string;
  color: string;
}

const TRADES: TradeInfo[] = [
  { key: 'pf', label: 'Pipefitter', color: '#3b82f6' },
  { key: 'sm', label: 'Sheet Metal', color: '#10b981' },
  { key: 'pl', label: 'Plumber', color: '#f59e0b' },
];

// ─── Interfaces ────────────────────────────────────────────

interface TradeMonthlyHours {
  pf: number;
  sm: number;
  pl: number;
  total: number;
}

interface TradeHours {
  key: TradeName;
  remaining: number;
}

interface ProjectLaborProjection {
  contract: VPContract;
  remainingMonths: number;
  contour: ContourType;
  isAutoContour: boolean;
  pctComplete: number;
  tradeHours: TradeHours[];
  totalRemainingHours: number;
  monthlyHours: Map<string, TradeMonthlyHours>;
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

const LaborForecast: React.FC = () => {
  // Filters
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [marketFilter, setMarketFilter] = useState<string>('');
  const [pmFilter, setPmFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Overrides (shared with revenue page)
  const [adjustedEndMonths, setAdjustedEndMonths] = useState<Record<number, number>>({});
  const [selectedContours, setSelectedContours] = useState<Record<number, ContourType>>({});
  const [overridesInitialized, setOverridesInitialized] = useState(false);

  // View modes
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const [dataView, setDataView] = useState<'project' | 'trade'>('trade');

  // Settings
  const [hoursPerPersonPerMonth, setHoursPerPersonPerMonth] = useState<number>(173);
  const [durationRules, setDurationRules] = useState<DurationRule[]>(defaultDurationRules);
  const [showSettings, setShowSettings] = useState(false);

  const getDurationForValue = (contractValue: number): number => {
    for (const rule of durationRules) {
      if (contractValue >= rule.minValue && contractValue < rule.maxValue) {
        return rule.months;
      }
    }
    return 24;
  };

  // ─── Data fetching ───────────────────────────────────────

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['vpContracts', 'laborForecast'],
    queryFn: () => vistaDataService.getAllContracts({ status: '' }),
  });

  useEffect(() => {
    if (contracts && !overridesInitialized) {
      const endMonths: Record<number, number> = {};
      const contours: Record<number, ContourType> = {};
      contracts.forEach(c => {
        if (c.user_adjusted_end_months != null) endMonths[c.id] = c.user_adjusted_end_months;
        if (c.user_selected_contour) contours[c.id] = c.user_selected_contour as ContourType;
      });
      setAdjustedEndMonths(endMonths);
      setSelectedContours(contours);
      setOverridesInitialized(true);
    }
  }, [contracts, overridesInitialized]);

  const saveProjectionOverride = useCallback(async (
    contractId: number,
    overrides: { user_adjusted_end_months?: number | null; user_selected_contour?: string | null }
  ) => {
    try {
      await vistaDataService.updateProjectionOverrides(contractId, overrides);
    } catch (err) {
      console.error('Failed to save projection override:', err);
    }
  }, []);

  // ─── Filter options ──────────────────────────────────────

  const filterOptions = useMemo(() => {
    if (!contracts) return { departments: [], markets: [], pms: [] };
    const departments = new Set<string>();
    const markets = new Set<string>();
    const pms = new Set<string>();
    contracts.forEach(c => {
      if (c.department_code) departments.add(c.department_code);
      if (c.primary_market) markets.add(c.primary_market);
      if (c.project_manager_name) pms.add(c.project_manager_name);
    });
    return {
      departments: Array.from(departments).sort(),
      markets: Array.from(markets).sort(),
      pms: Array.from(pms).sort(),
    };
  }, [contracts]);

  // ─── Columns (12 months + yearly) ───────────────────────

  const columns = useMemo(() => {
    const cols: { key: string; label: string; isYear: boolean }[] = [];
    const now = startOfMonth(new Date());
    const twelveMonthsOut = addMonths(now, 11);
    for (let i = 0; i < 12; i++) {
      const date = addMonths(now, i);
      cols.push({ key: format(date, 'yyyy-MM'), label: format(date, 'MMM yy'), isYear: false });
    }
    const currentYear = now.getFullYear();
    const maxYear = currentYear + 3;
    for (let year = currentYear; year <= maxYear; year++) {
      const lastMonthOfYear = new Date(year, 11, 1);
      if (lastMonthOfYear > twelveMonthsOut) {
        cols.push({ key: String(year), label: String(year), isYear: true });
      }
    }
    return cols;
  }, []);

  // ─── Core projections ────────────────────────────────────

  const projections = useMemo(() => {
    if (!contracts) return [];

    const now = startOfMonth(new Date());
    const twelveMonthsOut = addMonths(now, 11);
    const results: ProjectLaborProjection[] = [];

    const filtered = contracts.filter(c => {
      const status = c.status?.toLowerCase() || '';
      if (statusFilter === 'all') {
        if (!status.includes('open') && !status.includes('soft')) return false;
      } else if (statusFilter === 'Open') {
        if (!status.includes('open')) return false;
      } else if (statusFilter === 'Soft-Closed') {
        if (!status.includes('soft')) return false;
      }
      if (departmentFilter && c.department_code !== departmentFilter) return false;
      if (marketFilter && c.primary_market !== marketFilter) return false;
      if (pmFilter && c.project_manager_name !== pmFilter) return false;
      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        const m1 = c.contract_number?.toLowerCase().includes(search);
        const m2 = c.description?.toLowerCase().includes(search);
        const m3 = c.customer_name?.toLowerCase().includes(search);
        if (!m1 && !m2 && !m3) return false;
      }
      return true;
    });

    for (const contract of filtered) {
      const earnedRevenue = parseNum(contract.earned_revenue);
      const projectedRevenue = parseNum(contract.projected_revenue);
      const backlog = parseNum(contract.backlog);
      const contractValue = parseNum(contract.contract_amount) || projectedRevenue;

      // Calculate remaining hours per trade
      const tradeHours: TradeHours[] = [
        { key: 'pf', remaining: Math.max(0, (parseNum((contract as any).pf_hours_projected) || parseNum((contract as any).pf_hours_estimate)) - parseNum((contract as any).pf_hours_jtd)) },
        { key: 'sm', remaining: Math.max(0, (parseNum((contract as any).sm_hours_projected) || parseNum((contract as any).sm_hours_estimate)) - parseNum((contract as any).sm_hours_jtd)) },
        { key: 'pl', remaining: Math.max(0, (parseNum((contract as any).pl_hours_projected) || parseNum((contract as any).pl_hours_estimate)) - parseNum((contract as any).pl_hours_jtd)) },
      ];

      const totalRemainingHours = tradeHours.reduce((sum, t) => sum + t.remaining, 0);

      // Skip contracts with no remaining labor hours
      if (totalRemainingHours <= 0) continue;

      // Calculate remaining months (same logic as revenue page)
      const userAdjustedMonths = adjustedEndMonths[contract.id];
      let remainingMonths = 0;

      if (backlog > 0) {
        if (userAdjustedMonths !== undefined) {
          remainingMonths = Math.max(1, Math.min(36, userAdjustedMonths));
        } else {
          const totalDuration = getDurationForValue(contractValue);
          const pctComplete = projectedRevenue > 0 ? earnedRevenue / projectedRevenue : 0;
          const monthsRemaining = Math.ceil(totalDuration * (1 - pctComplete));
          remainingMonths = Math.max(1, Math.min(36, monthsRemaining));
        }
      } else {
        // No backlog but hours remain - use a reasonable default
        remainingMonths = 3;
      }

      const pctComplete = projectedRevenue > 0 ? (earnedRevenue / projectedRevenue) * 100 : 0;
      const userSelectedContour = selectedContours[contract.id];
      const contour = userSelectedContour || getDefaultContour(pctComplete);
      const isAutoContour = !userSelectedContour;

      // Distribute hours across months
      const monthlyHours = new Map<string, TradeMonthlyHours>();

      if (remainingMonths > 0) {
        const multipliers = getContourMultipliers(remainingMonths, contour);

        for (let i = 0; i < remainingMonths; i++) {
          const monthDate = addMonths(now, i);
          const monthKey = format(monthDate, 'yyyy-MM');
          const yearKey = String(monthDate.getFullYear());

          const pfHrs = (tradeHours[0].remaining / remainingMonths) * multipliers[i];
          const smHrs = (tradeHours[1].remaining / remainingMonths) * multipliers[i];
          const plHrs = (tradeHours[2].remaining / remainingMonths) * multipliers[i];
          const totalHrs = pfHrs + smHrs + plHrs;

          // Monthly bucket
          const existing = monthlyHours.get(monthKey) || { pf: 0, sm: 0, pl: 0, total: 0 };
          monthlyHours.set(monthKey, {
            pf: existing.pf + pfHrs,
            sm: existing.sm + smHrs,
            pl: existing.pl + plHrs,
            total: existing.total + totalHrs,
          });

          // Year bucket (only for months beyond 12-month individual view)
          if (monthDate > twelveMonthsOut) {
            const yearExisting = monthlyHours.get(yearKey) || { pf: 0, sm: 0, pl: 0, total: 0 };
            monthlyHours.set(yearKey, {
              pf: yearExisting.pf + pfHrs,
              sm: yearExisting.sm + smHrs,
              pl: yearExisting.pl + plHrs,
              total: yearExisting.total + totalHrs,
            });
          }
        }
      }

      results.push({
        contract, remainingMonths, contour, isAutoContour, pctComplete,
        tradeHours, totalRemainingHours, monthlyHours,
      });
    }

    results.sort((a, b) => b.totalRemainingHours - a.totalRemainingHours);
    return results;
  }, [contracts, departmentFilter, marketFilter, pmFilter, statusFilter, searchFilter, adjustedEndMonths, selectedContours, durationRules]);

  // ─── Aggregations ────────────────────────────────────────

  const columnTotals = useMemo(() => {
    const totals = new Map<string, TradeMonthlyHours>();
    columns.forEach(col => {
      const agg: TradeMonthlyHours = { pf: 0, sm: 0, pl: 0, total: 0 };
      projections.forEach(p => {
        const h = p.monthlyHours.get(col.key);
        if (h) { agg.pf += h.pf; agg.sm += h.sm; agg.pl += h.pl; agg.total += h.total; }
      });
      totals.set(col.key, agg);
    });
    return totals;
  }, [projections, columns]);

  const grandTotalHours = useMemo(() =>
    projections.reduce((sum, p) => sum + p.totalRemainingHours, 0), [projections]);

  const grandTotalsByTrade = useMemo(() => {
    const totals = { pf: 0, sm: 0, pl: 0 };
    projections.forEach(p => {
      p.tradeHours.forEach(t => { totals[t.key] += t.remaining; });
    });
    return totals;
  }, [projections]);

  // ─── Tooltip helper ──────────────────────────────────────

  const cellTooltip = (h: TradeMonthlyHours): string => {
    const hpp = hoursPerPersonPerMonth;
    return `PF: ${(h.pf / hpp).toFixed(1)} (${fmtHours(h.pf)} hrs)\nSM: ${(h.sm / hpp).toFixed(1)} (${fmtHours(h.sm)} hrs)\nPL: ${(h.pl / hpp).toFixed(1)} (${fmtHours(h.pl)} hrs)\nTotal: ${(h.total / hpp).toFixed(1)} (${fmtHours(h.total)} hrs)`;
  };

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════

  if (isLoading) {
    return <div className="loading">Loading contracts...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <Link to="/projects" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.8rem' }}>&larr; Projects</Link>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem' }}>Labor Forecast</h2>
          <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
            {projections.length} projects | Total Remaining: {fmtHours(grandTotalHours)} hours
            {' '}| Peak Headcount: {fmtHeadcount(Math.max(...Array.from(columnTotals.values()).map(h => h.total), 0), hoursPerPersonPerMonth)} people
          </div>
        </div>
        <div>
          <Link
            to="/projects/projected-revenue"
            style={{ fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none' }}
          >
            Projected Revenue &rarr;
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Search</label>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Contract, customer..."
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '150px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
              <option value="all">Open + Soft-Closed</option>
              <option value="Open">Open Only</option>
              <option value="Soft-Closed">Soft-Closed Only</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Department</label>
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
              <option value="">All Departments</option>
              {filterOptions.departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Market</label>
            <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
              <option value="">All Markets</option>
              {filterOptions.markets.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Project Manager</label>
            <select value={pmFilter} onChange={(e) => setPmFilter(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
              <option value="">All PMs</option>
              {filterOptions.pms.map(pm => <option key={pm} value={pm}>{pm}</option>)}
            </select>
          </div>

          {(searchFilter || departmentFilter || marketFilter || pmFilter || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearchFilter(''); setDepartmentFilter(''); setMarketFilter(''); setPmFilter(''); setStatusFilter('all'); }}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem' }}
            >
              Clear Filters
            </button>
          )}

          {/* Controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                background: showSettings ? '#f59e0b' : '#f1f5f9',
                color: showSettings ? '#fff' : '#64748b',
                border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.25rem'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
              Settings
            </button>

            {/* Data view toggle */}
            <div style={{ display: 'flex', gap: '0' }}>
              <button
                onClick={() => setDataView('trade')}
                style={{
                  padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                  background: dataView === 'trade' ? '#8b5cf6' : '#f1f5f9',
                  color: dataView === 'trade' ? '#fff' : '#64748b',
                  border: '1px solid #e2e8f0', borderRadius: '4px 0 0 4px', cursor: 'pointer',
                }}
              >
                By Trade
              </button>
              <button
                onClick={() => setDataView('project')}
                style={{
                  padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                  background: dataView === 'project' ? '#8b5cf6' : '#f1f5f9',
                  color: dataView === 'project' ? '#fff' : '#64748b',
                  border: '1px solid #e2e8f0', borderRadius: '0 4px 4px 0', cursor: 'pointer',
                }}
              >
                By Project
              </button>
            </div>

            {/* View mode toggle */}
            <div style={{ display: 'flex', gap: '0' }}>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                  background: viewMode === 'table' ? '#3b82f6' : '#f1f5f9',
                  color: viewMode === 'table' ? '#fff' : '#64748b',
                  border: '1px solid #e2e8f0', borderRadius: '4px 0 0 4px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.25rem'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
                Table
              </button>
              <button
                onClick={() => setViewMode('graph')}
                style={{
                  padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                  background: viewMode === 'graph' ? '#3b82f6' : '#f1f5f9',
                  color: viewMode === 'graph' ? '#fff' : '#64748b',
                  border: '1px solid #e2e8f0', borderRadius: '0 4px 4px 0', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.25rem'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                Graph
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: '#fffbeb', border: '1px solid #fcd34d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400e', margin: 0 }}>Settings</h3>
            <button onClick={() => { setDurationRules(defaultDurationRules); setHoursPerPersonPerMonth(173); }}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '4px', cursor: 'pointer', color: '#92400e' }}>
              Reset to Defaults
            </button>
          </div>

          {/* Hours per person */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: '#1e293b', display: 'block', marginBottom: '0.5rem' }}>
              Hours per Person per Month
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="number" min="100" max="220"
                value={hoursPerPersonPerMonth}
                onChange={(e) => setHoursPerPersonPerMonth(Math.max(100, Math.min(220, parseInt(e.target.value) || 173)))}
                style={{ width: '70px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', textAlign: 'center' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[{ label: '173 (Std)', val: 173 }, { label: '160', val: 160 }, { label: '150', val: 150 }].map(p => (
                  <button key={p.val} onClick={() => setHoursPerPersonPerMonth(p.val)}
                    style={{
                      padding: '0.2rem 0.5rem', fontSize: '0.65rem', borderRadius: '3px', cursor: 'pointer',
                      background: hoursPerPersonPerMonth === p.val ? '#3b82f6' : '#f1f5f9',
                      color: hoursPerPersonPerMonth === p.val ? '#fff' : '#64748b',
                      border: '1px solid #e2e8f0',
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Duration rules */}
          <label style={{ fontSize: '0.75rem', fontWeight: 500, color: '#1e293b', display: 'block', marginBottom: '0.5rem' }}>
            Project Duration Rules by Contract Value
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {durationRules.map((rule, index) => (
              <div key={index} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#1e293b' }}>{rule.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Duration:</label>
                  <input type="number" min="1" max="36" value={rule.months}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 1;
                      setDurationRules(rules => rules.map((r, i) => i === index ? { ...r, months: Math.max(1, Math.min(36, v)) } : r));
                    }}
                    style={{ width: '50px', padding: '0.25rem 0.35rem', fontSize: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '4px', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>months</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TABLE VIEW ─── */}
      {viewMode === 'table' && (
        <>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {dataView === 'project' ? (
                    <>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', position: 'sticky', left: 0, background: '#f8fafc', minWidth: '200px' }}>Project</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', minWidth: '80px' }}>Rem. Hours</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '110px' }}>PF / SM / PL</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', minWidth: '50px' }}>% Comp</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '60px' }}>End</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '80px' }}>Contour</th>
                    </>
                  ) : (
                    <>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', position: 'sticky', left: 0, background: '#f8fafc', minWidth: '140px' }}>Trade</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', minWidth: '90px' }}>Total Remaining</th>
                    </>
                  )}
                  {columns.map(col => (
                    <th key={col.key} style={{
                      padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0',
                      minWidth: col.isYear ? '70px' : '55px', background: col.isYear ? '#f1f5f9' : '#f8fafc'
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataView === 'project' ? (
                  /* ─── PROJECT ROWS ─── */
                  projections.map(p => (
                    <tr key={p.contract.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.4rem 0.5rem', position: 'sticky', left: 0, background: '#fff' }}>
                        <div style={{ fontWeight: 500 }}>
                          {p.contract.linked_project_id ? (
                            <Link to={`/projects/${p.contract.linked_project_id}`} style={{ color: '#1e40af', textDecoration: 'none' }}>
                              {p.contract.contract_number}
                            </Link>
                          ) : p.contract.contract_number}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                          {p.contract.description || p.contract.customer_name}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                          {p.contract.project_manager_name} | {p.contract.department_code}
                        </div>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>
                        {fmtHours(p.totalRemainingHours)}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.65rem' }}>
                        <span style={{ color: TRADES[0].color }}>{fmtHours(p.tradeHours[0].remaining)}</span>
                        {' / '}
                        <span style={{ color: TRADES[1].color }}>{fmtHours(p.tradeHours[1].remaining)}</span>
                        {' / '}
                        <span style={{ color: TRADES[2].color }}>{fmtHours(p.tradeHours[2].remaining)}</span>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#64748b' }}>
                        {p.pctComplete > 0 ? `${p.pctComplete.toFixed(0)}%` : '-'}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.65rem' }}>
                        <select
                          value={p.remainingMonths}
                          onChange={(e) => {
                            const v = parseInt(e.target.value);
                            setAdjustedEndMonths(prev => ({ ...prev, [p.contract.id]: v }));
                            saveProjectionOverride(p.contract.id, { user_adjusted_end_months: v });
                          }}
                          style={{
                            padding: '0.15rem 0.25rem', fontSize: '0.65rem',
                            border: adjustedEndMonths[p.contract.id] !== undefined ? '1px solid #16a34a' : '1px solid #e2e8f0',
                            borderRadius: '3px',
                            background: adjustedEndMonths[p.contract.id] !== undefined ? '#dcfce7' : 'transparent',
                            color: adjustedEndMonths[p.contract.id] !== undefined ? '#15803d' : '#64748b',
                            cursor: 'pointer', width: '65px'
                          }}
                        >
                          {Array.from({ length: 36 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>{format(addMonths(startOfMonth(new Date()), m), 'MMM yy')}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                          <ContourVisual contour={p.contour} />
                          <select
                            value={p.contour}
                            onChange={(e) => {
                              const v = e.target.value as ContourType;
                              setSelectedContours(prev => ({ ...prev, [p.contract.id]: v }));
                              saveProjectionOverride(p.contract.id, { user_selected_contour: v });
                            }}
                            style={{
                              padding: '0.15rem 0.25rem', fontSize: '0.65rem',
                              border: p.isAutoContour ? '1px dashed #94a3b8' : '1px solid #16a34a',
                              borderRadius: '3px',
                              background: p.isAutoContour ? '#f8fafc' : '#dcfce7',
                              cursor: 'pointer', width: '55px',
                              color: p.isAutoContour ? '#64748b' : '#15803d',
                              fontStyle: p.isAutoContour ? 'italic' : 'normal'
                            }}
                            title={p.isAutoContour ? `Auto-selected based on ${p.pctComplete.toFixed(0)}% complete` : 'User-selected contour'}
                          >
                            {contourOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </div>
                      </td>
                      {columns.map(col => {
                        const h = p.monthlyHours.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
                        return (
                          <td key={col.key} title={h.total > 0 ? cellTooltip(h) : ''}
                            style={{
                              padding: '0.4rem 0.5rem', textAlign: 'right',
                              color: h.total > 0 ? '#1e293b' : '#cbd5e1',
                              fontWeight: h.total > 0 ? 500 : 400,
                              background: col.isYear ? '#fafafa' : 'transparent',
                            }}>
                            {fmtHeadcount(h.total, hoursPerPersonPerMonth)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  /* ─── TRADE SUMMARY ROWS ─── */
                  [...TRADES, { key: 'total' as any, label: 'TOTAL', color: '#1e293b' }].map((trade) => (
                    <tr key={trade.key} style={{
                      borderBottom: '1px solid #f1f5f9',
                      fontWeight: trade.key === 'total' ? 600 : 400,
                      background: trade.key === 'total' ? '#f1f5f9' : 'transparent',
                    }}>
                      <td style={{
                        padding: '0.5rem', position: 'sticky', left: 0,
                        background: trade.key === 'total' ? '#f1f5f9' : '#fff',
                        borderLeft: trade.key !== 'total' ? `3px solid ${trade.color}` : 'none',
                      }}>
                        <span style={{ fontWeight: 500, color: trade.color }}>{trade.label}</span>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500 }}>
                        {trade.key === 'total'
                          ? fmtHours(grandTotalHours)
                          : fmtHours(grandTotalsByTrade[trade.key as TradeName] || 0)
                        }
                      </td>
                      {columns.map(col => {
                        const ct = columnTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
                        const hours = trade.key === 'total' ? ct.total : ct[trade.key as TradeName] || 0;
                        return (
                          <td key={col.key}
                            title={hours > 0 ? `${(hours / hoursPerPersonPerMonth).toFixed(1)} people (${fmtHours(hours)} hrs)` : ''}
                            style={{
                              padding: '0.5rem', textAlign: 'right',
                              color: hours > 0 ? '#1e293b' : '#cbd5e1',
                              fontWeight: hours > 0 ? 500 : 400,
                              background: col.isYear ? (trade.key === 'total' ? '#e8ecf0' : '#fafafa') : (trade.key === 'total' ? '#f1f5f9' : 'transparent'),
                            }}>
                            {fmtHeadcount(hours, hoursPerPersonPerMonth)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
              {dataView === 'project' && (
                <tfoot>
                  <tr style={{ background: '#f1f5f9', fontWeight: 600 }}>
                    <td style={{ padding: '0.5rem', position: 'sticky', left: 0, background: '#f1f5f9' }}>
                      TOTAL ({projections.length} projects)
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{fmtHours(grandTotalHours)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.65rem' }}>
                      <span style={{ color: TRADES[0].color }}>{fmtHours(grandTotalsByTrade.pf)}</span>
                      {' / '}
                      <span style={{ color: TRADES[1].color }}>{fmtHours(grandTotalsByTrade.sm)}</span>
                      {' / '}
                      <span style={{ color: TRADES[2].color }}>{fmtHours(grandTotalsByTrade.pl)}</span>
                    </td>
                    <td style={{ padding: '0.5rem' }}>-</td>
                    <td style={{ padding: '0.5rem' }}>-</td>
                    <td style={{ padding: '0.5rem' }}>-</td>
                    {columns.map(col => {
                      const ct = columnTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
                      return (
                        <td key={col.key} title={ct.total > 0 ? cellTooltip(ct) : ''}
                          style={{ padding: '0.5rem', textAlign: 'right', background: col.isYear ? '#e8ecf0' : '#f1f5f9' }}>
                          {fmtHeadcount(ct.total, hoursPerPersonPerMonth)}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Legend */}
          <div style={{ marginTop: '1rem', fontSize: '0.7rem', color: '#64748b' }}>
            <strong>How it works:</strong> Remaining hours per trade (Projected - JTD) are distributed using the same contour and end date as revenue projections.
            Headcount = Monthly Hours &divide; {hoursPerPersonPerMonth} hrs/person/month.
            <br />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', alignItems: 'center' }}>
              <strong>Trades:</strong>
              {TRADES.map(t => (
                <span key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', background: t.color, borderRadius: '2px' }} />
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── GRAPH VIEW ─── */}
      {viewMode === 'graph' && (
        <div className="card" style={{ padding: '1rem' }}>
          {/* Stacked bar chart - Monthly Headcount */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
              Projected Headcount by Month (Next 36 Months)
            </h3>
            <div style={{ height: '320px', position: 'relative' }}>
              {(() => {
                const now = startOfMonth(new Date());
                const monthlyData: { label: string; key: string; pf: number; sm: number; pl: number; total: number }[] = [];
                let maxValue = 0;

                for (let i = 0; i < 36; i++) {
                  const monthDate = addMonths(now, i);
                  const key = format(monthDate, 'yyyy-MM');
                  const agg = { pf: 0, sm: 0, pl: 0, total: 0 };
                  projections.forEach(p => {
                    const h = p.monthlyHours.get(key);
                    if (h) { agg.pf += h.pf; agg.sm += h.sm; agg.pl += h.pl; agg.total += h.total; }
                  });
                  monthlyData.push({ label: format(monthDate, 'MMM yy'), key, ...agg });
                  const headcount = agg.total / hoursPerPersonPerMonth;
                  if (headcount > maxValue) maxValue = headcount;
                }

                maxValue = Math.ceil(maxValue / 5) * 5; // Round up to nearest 5
                if (maxValue === 0) maxValue = 10;

                const barWidth = 100 / 36;
                const chartHeight = 250;

                const yearBoundaries: { index: number; year: string }[] = [];
                monthlyData.forEach((d, i) => {
                  if (d.key.endsWith('-01')) yearBoundaries.push({ index: i, year: d.key.substring(0, 4) });
                });

                return (
                  <svg width="100%" height={chartHeight + 50} style={{ overflow: 'visible' }}>
                    {/* Y-axis */}
                    <text x="0" y="10" fontSize="10" fill="#64748b">{maxValue} ppl</text>
                    <text x="0" y={chartHeight / 2} fontSize="10" fill="#64748b">{(maxValue / 2).toFixed(0)}</text>
                    <text x="0" y={chartHeight} fontSize="10" fill="#64748b">0</text>

                    <line x1="40" y1="0" x2="100%" y2="0" stroke="#e2e8f0" strokeDasharray="2,2" />
                    <line x1="40" y1={chartHeight / 2} x2="100%" y2={chartHeight / 2} stroke="#e2e8f0" strokeDasharray="2,2" />
                    <line x1="40" y1={chartHeight} x2="100%" y2={chartHeight} stroke="#e2e8f0" />

                    <g transform="translate(45, 0)">
                      {yearBoundaries.map(yb => (
                        <line key={`yl-${yb.year}`} x1={`${(yb.index / 36) * 95}%`} y1="0" x2={`${(yb.index / 36) * 95}%`} y2={chartHeight + 5} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,2" />
                      ))}

                      {monthlyData.map((d, i) => {
                        const hpp = hoursPerPersonPerMonth;
                        const pfHC = d.pf / hpp;
                        const smHC = d.sm / hpp;
                        const plHC = d.pl / hpp;
                        const totalHC = pfHC + smHC + plHC;

                        const pfH = maxValue > 0 ? (pfHC / maxValue) * chartHeight : 0;
                        const smH = maxValue > 0 ? (smHC / maxValue) * chartHeight : 0;
                        const plH = maxValue > 0 ? (plHC / maxValue) * chartHeight : 0;

                        const xPercent = (i / 36) * 95;
                        const showMonth = i % 3 === 0;

                        return (
                          <g key={d.key}>
                            {/* PL at bottom */}
                            <rect x={`${xPercent}%`} y={chartHeight - plH} width={`${barWidth * 0.8}%`} height={plH} fill={TRADES[2].color} rx="1">
                              <title>{d.label}: PL {plHC.toFixed(1)}, SM {smHC.toFixed(1)}, PF {pfHC.toFixed(1)} = {totalHC.toFixed(1)} people</title>
                            </rect>
                            {/* SM in middle */}
                            <rect x={`${xPercent}%`} y={chartHeight - plH - smH} width={`${barWidth * 0.8}%`} height={smH} fill={TRADES[1].color} rx="1">
                              <title>{d.label}: PL {plHC.toFixed(1)}, SM {smHC.toFixed(1)}, PF {pfHC.toFixed(1)} = {totalHC.toFixed(1)} people</title>
                            </rect>
                            {/* PF on top */}
                            <rect x={`${xPercent}%`} y={chartHeight - plH - smH - pfH} width={`${barWidth * 0.8}%`} height={pfH} fill={TRADES[0].color} rx="1">
                              <title>{d.label}: PL {plHC.toFixed(1)}, SM {smHC.toFixed(1)}, PF {pfHC.toFixed(1)} = {totalHC.toFixed(1)} people</title>
                            </rect>
                            {showMonth && (
                              <text x={`${xPercent + barWidth * 0.4}%`} y={chartHeight + 14} fontSize="9" fill="#64748b" textAnchor="middle">
                                {d.label.substring(0, 3)}
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {yearBoundaries.map((yb, idx) => {
                        const xStart = (yb.index / 36) * 95;
                        const nextB = yearBoundaries[idx + 1];
                        const xEnd = nextB ? (nextB.index / 36) * 95 : 95;
                        return (
                          <text key={`ylbl-${yb.year}`} x={`${(xStart + xEnd) / 2}%`} y={chartHeight + 32} fontSize="11" fontWeight="600" fill="#1e293b" textAnchor="middle">
                            {yb.year}
                          </text>
                        );
                      })}
                      {yearBoundaries.length > 0 && yearBoundaries[0].index > 0 && (
                        <text x={`${(yearBoundaries[0].index / 36) * 95 / 2}%`} y={chartHeight + 32} fontSize="11" fontWeight="600" fill="#1e293b" textAnchor="middle">
                          {monthlyData[0].key.substring(0, 4)}
                        </text>
                      )}
                    </g>
                  </svg>
                );
              })()}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.7rem', color: '#64748b', marginTop: '0.5rem' }}>
              {TRADES.map(t => (
                <span key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', background: t.color, borderRadius: '2px' }} />
                  {t.label}
                </span>
              ))}
            </div>
          </div>

          {/* Trade breakdown bars */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
              Total Remaining Hours by Trade
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {TRADES.map(trade => {
                const hrs = grandTotalsByTrade[trade.key];
                const maxHrs = Math.max(grandTotalsByTrade.pf, grandTotalsByTrade.sm, grandTotalsByTrade.pl, 1);
                return (
                  <div key={trade.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '100px', fontSize: '0.75rem', fontWeight: 500, color: trade.color }}>{trade.label}</div>
                    <div style={{ flex: 1, background: '#e2e8f0', borderRadius: '4px', height: '24px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${(hrs / maxHrs) * 100}%`, background: trade.color, height: '100%', borderRadius: '4px',
                        display: 'flex', alignItems: 'center', paddingLeft: '0.5rem',
                      }}>
                        <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 500 }}>
                          {fmtHours(hrs)} hrs ({(hrs / hoursPerPersonPerMonth).toFixed(0)} person-months)
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Headcount by Department */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
              Total Remaining Hours by Department
            </h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {(() => {
                const deptTotals: Record<string, number> = {};
                projections.forEach(p => {
                  const dept = p.contract.department_code || 'Unknown';
                  deptTotals[dept] = (deptTotals[dept] || 0) + p.totalRemainingHours;
                });
                const sorted = Object.entries(deptTotals).sort((a, b) => b[1] - a[1]);
                const maxDept = sorted[0]?.[1] || 1;
                return sorted.map(([dept, total]) => (
                  <div key={dept} style={{ flex: '1', minWidth: '150px', maxWidth: '250px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 500 }}>{dept}</span>
                      <span style={{ color: '#64748b' }}>{fmtHours(total)} hrs</span>
                    </div>
                    <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ width: `${(total / maxDept) * 100}%`, background: '#8b5cf6', height: '100%', borderRadius: '4px' }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Quarterly Summary */}
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
              Projected Headcount by Quarter
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {(() => {
                const now = startOfMonth(new Date());
                const quarters: { label: string; total: number }[] = [];
                for (let q = 0; q < 12; q++) {
                  const startMonth = q * 3;
                  let total = 0;
                  for (let m = 0; m < 3; m++) {
                    const monthDate = addMonths(now, startMonth + m);
                    const key = format(monthDate, 'yyyy-MM');
                    projections.forEach(p => {
                      const h = p.monthlyHours.get(key);
                      if (h) total += h.total;
                    });
                  }
                  const avgMonthlyHeadcount = (total / 3) / hoursPerPersonPerMonth;
                  const qStart = addMonths(now, startMonth);
                  const qNum = Math.floor(qStart.getMonth() / 3) + 1;
                  quarters.push({ label: `Q${qNum} ${qStart.getFullYear()}`, total: avgMonthlyHeadcount });
                }
                return quarters.map((q, i) => (
                  <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>{q.label}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
                      {q.total > 0 ? `${q.total.toFixed(1)}` : '-'}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>avg people</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaborForecast;
