import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { vistaDataService, VPContract, ShopFieldHours } from '../../services/vistaData';
import opportunitiesService, { OpportunityWithEstimate } from '../../services/opportunities';
import { getForecastRules, ForecastDurationRule } from '../../services/tenant';
import { useAuth } from '../../context/AuthContext';
import { teamsApi } from '../../services/teams';
import SearchableSelect from '../../components/SearchableSelect';
import MultiSearchableSelect from '../../components/MultiSearchableSelect';
import '../../components/modals/Modal.css';
import '../../styles/SalesPipeline.css';
import { format, addMonths, addWeeks, startOfMonth, startOfWeek, differenceInMonths, parseISO, isBefore } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    const token = localStorage.getItem('token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status !== 200) { reject(new Error(`Failed: ${xhr.status}`)); return; }
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(xhr.response);
    };
    xhr.onerror = () => reject(new Error('Failed to load image'));
    xhr.send();
  });
}

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

const fmtCompact = (value: number): string => {
  if (value === 0) return '-';
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const fmtHeadcount = (hours: number, hrsPerPerson: number): string => {
  if (hours === 0) return '-';
  const hc = hours / hrsPerPerson;
  if (hc < 0.1) return '-';
  return hc.toFixed(1);
};

// ─── Contour types ─────────────────────────────────────────

type ContourType = 'flat' | 'front' | 'back' | 'bell' | 'turtle' | 'double' | 'early' | 'late' | 'scurve' | 'rampup' | 'rampdown' | 'gradual';

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
  { value: 'gradual', label: 'Gradual', icon: '◠' },
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
      case 'gradual': weight = Math.pow(Math.sin(position * Math.PI), 2) * 1.5 + 0.2; break;
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
      case 'gradual': return '0,15 3,14 6,12 10,6 14,3 18,6 21,12 24,15';
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

// ─── Location groups (derived from department code prefix) ──

import { LOCATION_GROUPS } from '../../constants/locationGroups';

const getLocationGroup = (deptCode: string | null | undefined): string | null => {
  if (!deptCode) return null;
  const prefix = deptCode.substring(0, 2);
  const group = LOCATION_GROUPS.find(g => g.prefix === prefix);
  return group ? group.label : null;
};

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

type SFEntry = { est: number; jtd: number; est_cost: number; jtd_cost: number; projected_cost: number };
type SFByTrade = Partial<Record<TradeName, Partial<Record<'shop' | 'field', SFEntry>>>>;

interface ProjectLaborProjection {
  contract: VPContract;
  startOffset: number;
  remainingMonths: number;
  contour: ContourType;
  isAutoContour: boolean;
  pctComplete: number;
  tradeHours: TradeHours[];
  totalRemainingHours: number;
  monthlyHours: Map<string, TradeMonthlyHours>;
}

interface OpportunityLaborProjection {
  opportunity: OpportunityWithEstimate;
  projectedStart: Date;
  workDurationMonths: number;
  contour: ContourType;
  probability: number;
  weightedTradeHours: TradeHours[];
  weightedTotalHours: number;
  monthlyHours: Map<string, TradeMonthlyHours>;
}

// Default pursuit-to-award rules (how long from now until opportunity becomes a contract)
const defaultPursuitRules: ForecastDurationRule[] = [
  { minValue: 0, maxValue: 500000, months: 2, label: '$0 - $500K' },
  { minValue: 500000, maxValue: 2000000, months: 4, label: '$500K - $2M' },
  { minValue: 2000000, maxValue: 5000000, months: 6, label: '$2M - $5M' },
  { minValue: 5000000, maxValue: 10000000, months: 9, label: '$5M - $10M' },
  { minValue: 10000000, maxValue: Infinity, months: 12, label: '$10M+' },
];

// Default work duration rules (how long the mechanical work takes once awarded)
const defaultWorkDurationRules: ForecastDurationRule[] = [
  { minValue: 0, maxValue: 500000, months: 3, label: '$0 - $500K' },
  { minValue: 500000, maxValue: 2000000, months: 6, label: '$500K - $2M' },
  { minValue: 2000000, maxValue: 5000000, months: 8, label: '$2M - $5M' },
  { minValue: 5000000, maxValue: 10000000, months: 12, label: '$5M - $10M' },
  { minValue: 10000000, maxValue: Infinity, months: 24, label: '$10M+' },
];

const getOppDurationForValue = (value: number, rules: ForecastDurationRule[]): number => {
  for (const rule of rules) {
    if (value >= rule.minValue && value < rule.maxValue) return rule.months;
  }
  return 24;
};

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

const LaborForecast: React.FC = () => {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const logoUrl = tenant?.settings?.branding?.logo_url ? '/api/tenant/logo' : undefined;

  // My Projects / My Team
  const [myProjectsOnly, setMyProjectsOnly] = useState(false);
  const [myTeamOnly, setMyTeamOnly] = useState(false);

  const { data: myTeamResponse } = useQuery({
    queryKey: ['teams', 'my-team-members'],
    queryFn: () => teamsApi.getMyTeamMemberIds()
  });
  const teamMemberNames = useMemo(() => {
    const names: string[] = (myTeamResponse?.data as any)?.data?.names || [];
    return new Set(names.map(n => n.toLowerCase()));
  }, [myTeamResponse]);

  // Filters
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [marketFilter, setMarketFilter] = useState<string>('');
  const [pmFilter, setPmFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [locationGroupFilter, setLocationGroupFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<'both' | 'shop' | 'field'>('both');
  const [drillDownCol, setDrillDownCol] = useState<{ key: string; label: string; monthKey: string } | null>(null);

  // Trade filter
  const [tradeFilter, setTradeFilter] = useState<TradeName[]>(['pf', 'sm', 'pl']);
  const filteredTrades = TRADES.filter(t => tradeFilter.includes(t.key));
  const applyTradeFilter = (h: TradeMonthlyHours): TradeMonthlyHours => {
    const pf = tradeFilter.includes('pf') ? h.pf : 0;
    const sm = tradeFilter.includes('sm') ? h.sm : 0;
    const pl = tradeFilter.includes('pl') ? h.pl : 0;
    return { pf, sm, pl, total: pf + sm + pl };
  };

  // Opportunity overlay
  const [oppMode, setOppMode] = useState<'off' | 'all' | 'select'>('off');
  const [selectedOppIds, setSelectedOppIds] = useState<number[]>([]);
  const [oppWeighted, setOppWeighted] = useState(true);

  // Overrides (shared with revenue page)
  const [adjustedStartMonths, setAdjustedStartMonths] = useState<Record<number, number>>({});
  const [adjustedEndMonths, setAdjustedEndMonths] = useState<Record<number, number>>({});
  const [selectedContours, setSelectedContours] = useState<Record<number, ContourType>>({});
  const [overridesInitialized, setOverridesInitialized] = useState(false);

  // View modes
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');
  const [dataView, setDataView] = useState<'project' | 'trade'>('trade');

  // Sorting state
  const [sortColumn, setSortColumn] = useState<'project' | 'hours' | 'completion'>('hours');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Handle column header click for sorting
  const handleSort = (column: 'project' | 'hours' | 'completion') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'project' ? 'asc' : 'desc');
    }
  };

  // Sort indicator component
  const SortIndicator: React.FC<{ column: 'project' | 'hours' | 'completion' }> = ({ column }) => {
    if (sortColumn !== column) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>⇅</span>;
    return <span style={{ marginLeft: '4px' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  // Settings
  const [hoursPerPersonPerMonth, setHoursPerPersonPerMonth] = useState<number>(173);
  const [durationRules, setDurationRules] = useState<DurationRule[]>(defaultDurationRules);
  const [showSettings, setShowSettings] = useState(false);
  const [timeHorizon, setTimeHorizon] = useState<number>(12);
  const [granularity, setGranularity] = useState<'monthly' | 'weekly'>('monthly');

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

  const { data: shopFieldData } = useQuery({
    queryKey: ['vpShopFieldHours'],
    queryFn: () => vistaDataService.getShopFieldHours(),
  });

  // Opportunity data (lazy-loaded when overlay is enabled)
  const { data: opportunitiesWithEstimates } = useQuery({
    queryKey: ['opportunities', 'withEstimates'],
    queryFn: () => opportunitiesService.getWithEstimates(),
    enabled: oppMode !== 'off',
  });

  const { data: forecastRules } = useQuery({
    queryKey: ['forecastRules'],
    queryFn: getForecastRules,
    enabled: oppMode !== 'off',
  });

  // Build lookup: contractNumber -> { trade -> { shop: {est,jtd}, field: {est,jtd} } }
  const shopFieldMap = useMemo(() => {
    if (!shopFieldData) return new Map<string, SFByTrade>();
    const map = new Map<string, SFByTrade>();
    for (const row of shopFieldData) {
      if (!map.has(row.contract_number)) map.set(row.contract_number, {});
      const byTrade = map.get(row.contract_number)!;
      if (!byTrade[row.trade as TradeName]) byTrade[row.trade as TradeName] = {};
      byTrade[row.trade as TradeName]![row.location as 'shop' | 'field'] = {
        est: parseNum(row.est_hours),
        jtd: parseNum(row.jtd_hours),
        est_cost: parseNum(row.est_cost),
        jtd_cost: parseNum(row.jtd_cost),
        projected_cost: parseNum(row.projected_cost),
      };
    }
    return map;
  }, [shopFieldData]);

  useEffect(() => {
    if (contracts && !overridesInitialized) {
      const startMonths: Record<number, number> = {};
      const endMonths: Record<number, number> = {};
      const contours: Record<number, ContourType> = {};
      contracts.forEach(c => {
        if (c.user_adjusted_start_months != null) startMonths[c.id] = c.user_adjusted_start_months;
        if (c.user_adjusted_end_months != null) endMonths[c.id] = c.user_adjusted_end_months;
        if (c.user_selected_contour) contours[c.id] = c.user_selected_contour as ContourType;
      });
      setAdjustedStartMonths(startMonths);
      setAdjustedEndMonths(endMonths);
      setSelectedContours(contours);
      setOverridesInitialized(true);
    }
  }, [contracts, overridesInitialized]);

  const saveProjectionOverride = useCallback(async (
    contractId: number,
    overrides: { user_adjusted_end_months?: number | null; user_selected_contour?: string | null; user_adjusted_start_months?: number | null }
  ) => {
    try {
      await vistaDataService.updateProjectionOverrides(contractId, overrides);
      // Invalidate both labor forecast and projected revenue caches so they stay in sync
      queryClient.invalidateQueries({ queryKey: ['vpContracts'] });
    } catch (err) {
      console.error('Failed to save projection override:', err);
    }
  }, [queryClient]);

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

  // Dynamic project options filtered by other active filters
  const projectOptions = useMemo(() => {
    if (!contracts) return [];
    return contracts
      .filter(c => {
        const status = c.status?.toLowerCase() || '';
        if (statusFilter === 'all') {
          if (!status.includes('open') && !status.includes('soft')) return false;
        } else if (statusFilter === 'Open') {
          if (!status.includes('open')) return false;
        } else if (statusFilter === 'Soft-Closed') {
          if (!status.includes('soft')) return false;
        }
        if (departmentFilter.length > 0 && (!c.department_code || !departmentFilter.includes(c.department_code))) return false;
        if (locationGroupFilter.length > 0) {
          const group = getLocationGroup(c.department_code);
          if (!group || !locationGroupFilter.includes(group)) return false;
        }
        if (marketFilter && c.primary_market !== marketFilter) return false;
        if (pmFilter && c.project_manager_name !== pmFilter) return false;
        if (myProjectsOnly && user) {
          if (!c.project_manager_name) return false;
          const pmName = c.project_manager_name.toLowerCase();
          const reverseName = `${user.lastName}, ${user.firstName}`.toLowerCase();
          if (!pmName.startsWith(reverseName)) return false;
        }
        if (myTeamOnly && teamMemberNames.size > 0) {
          if (!c.project_manager_name) return false;
          const pmName = c.project_manager_name.toLowerCase();
          let matched = false;
          for (const name of teamMemberNames) {
            const parts = name.split(' ');
            if (parts.length >= 2) {
              const reversed = `${parts[parts.length - 1]}, ${parts[0]}`;
              if (pmName.startsWith(reversed)) { matched = true; break; }
            }
            if (pmName === name) { matched = true; break; }
          }
          if (!matched) return false;
        }
        if (searchFilter) {
          const search = searchFilter.toLowerCase();
          const m1 = c.contract_number?.toLowerCase().includes(search);
          const m2 = c.description?.toLowerCase().includes(search);
          const m3 = c.customer_name?.toLowerCase().includes(search);
          if (!m1 && !m2 && !m3) return false;
        }
        return true;
      })
      .map(c => ({
        value: c.contract_number,
        label: `${c.contract_number} — ${c.description || c.customer_name || ''}`.substring(0, 80),
        searchText: `${c.contract_number} ${c.description || ''} ${c.customer_name || ''} ${c.project_manager_name || ''}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [contracts, statusFilter, departmentFilter, locationGroupFilter, marketFilter, pmFilter, searchFilter, myProjectsOnly, myTeamOnly, user, teamMemberNames]);

  // Clear project filter selections that are no longer in the filtered list
  useEffect(() => {
    if (projectFilter.length > 0) {
      const validValues = new Set(projectOptions.map(o => o.value));
      const cleaned = projectFilter.filter(v => validValues.has(v));
      if (cleaned.length !== projectFilter.length) setProjectFilter(cleaned);
    }
  }, [projectFilter, projectOptions]);

  // ─── Columns (12 months + yearly) ───────────────────────

  const columns = useMemo(() => {
    const cols: { key: string; label: string; isYear: boolean }[] = [];
    const now = startOfMonth(new Date());
    for (let i = 0; i < timeHorizon; i++) {
      const date = addMonths(now, i);
      cols.push({ key: format(date, 'yyyy-MM'), label: format(date, 'MMM yy'), isYear: false });
    }
    return cols;
  }, [timeHorizon]);

  // ─── Weekly derivation ──────────────────────────────────

  const weekInfo = useMemo(() => {
    const weeks: { key: string; label: string; monthKey: string }[] = [];
    const weeksPerMonth: Record<string, number> = {};
    const now = startOfWeek(new Date(), { weekStartsOn: 1 });
    const horizonEnd = addMonths(startOfMonth(new Date()), timeHorizon);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const totalWeeks = Math.ceil((horizonEnd.getTime() - now.getTime()) / msPerWeek);

    for (let i = 0; i < totalWeeks; i++) {
      const weekStart = addWeeks(now, i);
      const key = format(weekStart, 'yyyy-MM-dd');
      const monthKey = format(weekStart, 'yyyy-MM');
      weeks.push({ key, label: format(weekStart, 'M/d'), monthKey });
      weeksPerMonth[monthKey] = (weeksPerMonth[monthKey] || 0) + 1;
    }

    return { weeks, weeksPerMonth };
  }, [timeHorizon]);

  const displayColumns = useMemo(() => {
    if (granularity === 'weekly' && timeHorizon <= 12) {
      return weekInfo.weeks.map(w => ({ key: w.key, label: w.label, isYear: false, monthKey: w.monthKey }));
    }
    return columns.map(c => ({ ...c, monthKey: c.key }));
  }, [granularity, timeHorizon, columns, weekInfo]);

  const getHoursForColumn = useCallback((monthlyHours: Map<string, TradeMonthlyHours>, col: { key: string; monthKey: string }): TradeMonthlyHours => {
    if (granularity !== 'weekly' || timeHorizon > 12) {
      return monthlyHours.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
    }
    const monthly = monthlyHours.get(col.monthKey);
    if (!monthly) return { pf: 0, sm: 0, pl: 0, total: 0 };
    const divisor = weekInfo.weeksPerMonth[col.monthKey] || 1;
    return { pf: monthly.pf / divisor, sm: monthly.sm / divisor, pl: monthly.pl / divisor, total: monthly.total / divisor };
  }, [granularity, timeHorizon, weekInfo]);

  // ─── Core projections ────────────────────────────────────

  const projections = useMemo(() => {
    if (!contracts) return [];

    const now = startOfMonth(new Date());
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
      if (departmentFilter.length > 0 && (!c.department_code || !departmentFilter.includes(c.department_code))) return false;
      if (locationGroupFilter.length > 0) {
        const group = getLocationGroup(c.department_code);
        if (!group || !locationGroupFilter.includes(group)) return false;
      }
      if (marketFilter && c.primary_market !== marketFilter) return false;
      if (pmFilter && c.project_manager_name !== pmFilter) return false;

      // My Projects filter — Vista PM names are "Last, First M" format
      if (myProjectsOnly && user) {
        if (!c.project_manager_name) return false;
        const pmName = c.project_manager_name.toLowerCase();
        const reverseName = `${user.lastName}, ${user.firstName}`.toLowerCase();
        if (!pmName.startsWith(reverseName)) return false;
      }

      // My Team filter — team names are "First Last", PM names are "Last, First M"
      if (myTeamOnly && teamMemberNames.size > 0) {
        if (!c.project_manager_name) return false;
        const pmName = c.project_manager_name.toLowerCase();
        let matched = false;
        for (const name of teamMemberNames) {
          const parts = name.split(' ');
          if (parts.length >= 2) {
            const reversed = `${parts[parts.length - 1]}, ${parts[0]}`;
            if (pmName.startsWith(reversed)) { matched = true; break; }
          }
          if (pmName === name) { matched = true; break; }
        }
        if (!matched) return false;
      }

      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        const m1 = c.contract_number?.toLowerCase().includes(search);
        const m2 = c.description?.toLowerCase().includes(search);
        const m3 = c.customer_name?.toLowerCase().includes(search);
        if (!m1 && !m2 && !m3) return false;
      }
      if (projectFilter.length > 0 && !projectFilter.includes(c.contract_number)) return false;
      return true;
    });

    for (const contract of filtered) {
      const earnedRevenue = parseNum(contract.earned_revenue);
      const projectedRevenue = parseNum(contract.projected_revenue);
      const backlog = parseNum(contract.backlog);
      const contractValue = parseNum(contract.contract_amount) || projectedRevenue;

      // Calculate remaining projected hours per trade from phase code cost data
      // Projected Hours = Projected Cost / Rate, where Rate = JTD Cost / JTD Hours (or Est Cost / Est Hours)
      // Remaining = Projected Hours - JTD Hours
      const sfData = shopFieldMap.get(contract.contract_number);

      const tradeHours: TradeHours[] = TRADES.map(trade => {
        const tradeData = sfData?.[trade.key];
        if (!tradeData) {
          // No phase code data for this trade — show 0 (consistent with Financials)
          return { key: trade.key, remaining: 0 };
        }

        // Sum shop + field for this trade
        const estHours = (tradeData.shop?.est || 0) + (tradeData.field?.est || 0);
        const jtdHours = (tradeData.shop?.jtd || 0) + (tradeData.field?.jtd || 0);
        const estCost = (tradeData.shop?.est_cost || 0) + (tradeData.field?.est_cost || 0);
        const jtdCost = (tradeData.shop?.jtd_cost || 0) + (tradeData.field?.jtd_cost || 0);
        const projCost = (tradeData.shop?.projected_cost || 0) + (tradeData.field?.projected_cost || 0);

        // Derive projected hours: Projected Cost / labor rate
        let projectedHours: number;
        if (projCost > 0) {
          const rate = jtdHours > 0 ? jtdCost / jtdHours
            : estHours > 0 ? estCost / estHours : 0;
          projectedHours = rate > 0 ? projCost / rate : estHours;
        } else {
          projectedHours = estHours;
        }

        const fullRemaining = Math.max(0, projectedHours - jtdHours);

        if (locationFilter === 'both') {
          return { key: trade.key, remaining: fullRemaining };
        }

        // Apply shop/field proportional scaling
        const estShop = tradeData.shop?.est || 0;
        const estField = tradeData.field?.est || 0;
        const estTotal = estShop + estField;

        let proportion: number;
        if (estTotal > 0) {
          proportion = locationFilter === 'shop' ? estShop / estTotal : estField / estTotal;
        } else {
          const jtdShop = tradeData.shop?.jtd || 0;
          const jtdField = tradeData.field?.jtd || 0;
          const jtdTotal = jtdShop + jtdField;
          proportion = jtdTotal > 0
            ? (locationFilter === 'shop' ? jtdShop / jtdTotal : jtdField / jtdTotal)
            : 0;
        }

        return { key: trade.key, remaining: fullRemaining * proportion };
      });

      const totalRemainingHours = tradeHours.reduce((sum, t) => sum + t.remaining, 0);

      // Skip contracts with no remaining labor hours
      if (totalRemainingHours <= 0) continue;

      // Start offset (months from now until work begins; 0 = current month)
      const startOffset = adjustedStartMonths[contract.id] ?? 0;

      // Calculate end offset and duration
      const userAdjustedEnd = adjustedEndMonths[contract.id];
      let endOffset: number;

      if (userAdjustedEnd !== undefined) {
        endOffset = Math.max(startOffset + 1, Math.min(36, userAdjustedEnd));
      } else if (backlog > 0) {
        const totalDuration = getDurationForValue(contractValue);
        const pctComplete = projectedRevenue > 0 ? earnedRevenue / projectedRevenue : 0;
        const monthsRemaining = Math.ceil(totalDuration * (1 - pctComplete));
        endOffset = startOffset + Math.max(1, Math.min(36, monthsRemaining));
      } else {
        // No backlog but hours remain - use a reasonable default
        endOffset = startOffset + 3;
      }

      const remainingMonths = endOffset - startOffset;

      const pctComplete = projectedRevenue > 0 ? (earnedRevenue / projectedRevenue) * 100 : 0;
      const userSelectedContour = selectedContours[contract.id];
      const contour = userSelectedContour || getDefaultContour(pctComplete);
      const isAutoContour = !userSelectedContour;

      // Distribute hours across months (offset by startOffset)
      const monthlyHours = new Map<string, TradeMonthlyHours>();

      if (remainingMonths > 0) {
        const multipliers = getContourMultipliers(remainingMonths, contour);

        for (let i = 0; i < remainingMonths; i++) {
          const monthDate = addMonths(now, startOffset + i);
          const monthKey = format(monthDate, 'yyyy-MM');

          const pfHrs = (tradeHours[0].remaining / remainingMonths) * multipliers[i];
          const smHrs = (tradeHours[1].remaining / remainingMonths) * multipliers[i];
          const plHrs = (tradeHours[2].remaining / remainingMonths) * multipliers[i];
          const totalHrs = pfHrs + smHrs + plHrs;

          const existing = monthlyHours.get(monthKey) || { pf: 0, sm: 0, pl: 0, total: 0 };
          monthlyHours.set(monthKey, {
            pf: existing.pf + pfHrs,
            sm: existing.sm + smHrs,
            pl: existing.pl + plHrs,
            total: existing.total + totalHrs,
          });
        }
      }

      results.push({
        contract, startOffset, remainingMonths, contour, isAutoContour, pctComplete,
        tradeHours, totalRemainingHours, monthlyHours,
      });
    }

    // Sort based on selected column and direction
    results.sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'project':
          const nameA = a.contract.contract_number?.toLowerCase() || '';
          const nameB = b.contract.contract_number?.toLowerCase() || '';
          comparison = nameA.localeCompare(nameB);
          break;
        case 'hours':
          comparison = a.totalRemainingHours - b.totalRemainingHours;
          break;
        case 'completion':
          comparison = a.pctComplete - b.pctComplete;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return results;
  }, [contracts, departmentFilter, locationGroupFilter, marketFilter, pmFilter, statusFilter, searchFilter, projectFilter, adjustedStartMonths, adjustedEndMonths, selectedContours, durationRules, sortColumn, sortDirection, locationFilter, shopFieldMap, myProjectsOnly, myTeamOnly, user, teamMemberNames]);

  // ─── Opportunity projections ──────────────────────────────

  const opportunityProjections = useMemo((): OpportunityLaborProjection[] => {
    if (oppMode === 'off' || !opportunitiesWithEstimates) return [];

    const now = startOfMonth(new Date());
    const pursuitRules = forecastRules?.pursuitRules || defaultPursuitRules;
    const workRules = forecastRules?.workDurationRules || defaultWorkDurationRules;
    const results: OpportunityLaborProjection[] = [];

    const filtered = opportunitiesWithEstimates.filter(opp => {
      if (oppMode === 'select' && !selectedOppIds.includes(opp.id)) return false;
      if (locationGroupFilter.length > 0) {
        if (!opp.location_group || !locationGroupFilter.includes(opp.location_group)) return false;
      }
      if (!opp.labor_pct || parseNum(opp.labor_pct) <= 0) return false;
      return true;
    });

    for (const opp of filtered) {
      const estimatedValue = parseNum(opp.estimated_value);
      const laborPct = parseNum(opp.labor_pct);
      const totalLaborDollars = estimatedValue * laborPct;

      // Calculate hours per trade
      const pfRate = parseNum(opp.pf_labor_rate) || 85;
      const smRate = parseNum(opp.sm_labor_rate) || 82;
      const plRate = parseNum(opp.pl_labor_rate) || 78;

      const pfHours = parseNum(opp.pf_labor_pct) > 0 && pfRate > 0
        ? (totalLaborDollars * parseNum(opp.pf_labor_pct)) / pfRate : 0;
      const smHours = parseNum(opp.sm_labor_pct) > 0 && smRate > 0
        ? (totalLaborDollars * parseNum(opp.sm_labor_pct)) / smRate : 0;
      const plHours = parseNum(opp.pl_labor_pct) > 0 && plRate > 0
        ? (totalLaborDollars * parseNum(opp.pl_labor_pct)) / plRate : 0;

      // Apply shop/field proportional scaling
      const applyLocationFilter = (hours: number, shopPct: number, fieldPct: number): number => {
        if (locationFilter === 'both') return hours;
        return locationFilter === 'shop' ? hours * shopPct : hours * fieldPct;
      };

      const filteredPf = applyLocationFilter(pfHours, parseNum(opp.pf_shop_pct), parseNum(opp.pf_field_pct));
      const filteredSm = applyLocationFilter(smHours, parseNum(opp.sm_shop_pct), parseNum(opp.sm_field_pct));
      const filteredPl = applyLocationFilter(plHours, parseNum(opp.pl_shop_pct), parseNum(opp.pl_field_pct));

      // Apply probability weighting (stage_probability is 'Low'/'Medium'/'High' text)
      const qualitativeProbMap: Record<string, number> = { 'High': 75, 'Medium': 50, 'Low': 25 };
      const probability = opp.probability && qualitativeProbMap[opp.probability]
        ? qualitativeProbMap[opp.probability]
        : (opp.stage_probability && qualitativeProbMap[opp.stage_probability as string]) || 0;
      const probFactor = oppWeighted ? (probability > 0 ? probability / 100 : 0) : 1;

      const weightedPf = filteredPf * probFactor;
      const weightedSm = filteredSm * probFactor;
      const weightedPl = filteredPl * probFactor;
      const weightedTotal = weightedPf + weightedSm + weightedPl;

      if (weightedTotal <= 0) continue;

      // Determine projected start date
      let projectedStart: Date;
      if (opp.user_adjusted_start_date) {
        projectedStart = startOfMonth(parseISO(opp.user_adjusted_start_date));
      } else if (opp.estimated_start_date && !isBefore(parseISO(opp.estimated_start_date), now)) {
        projectedStart = startOfMonth(parseISO(opp.estimated_start_date));
      } else {
        const pursuitMonths = getOppDurationForValue(estimatedValue, pursuitRules);
        projectedStart = addMonths(now, pursuitMonths);
      }

      // Determine work duration
      let workDurationMonths: number;
      if (opp.user_adjusted_duration_months != null) {
        workDurationMonths = opp.user_adjusted_duration_months;
      } else if (opp.estimated_end_date && opp.estimated_start_date) {
        workDurationMonths = Math.max(1, differenceInMonths(parseISO(opp.estimated_end_date), projectedStart));
      } else {
        workDurationMonths = getOppDurationForValue(estimatedValue, workRules);
      }
      workDurationMonths = Math.max(1, Math.min(36, workDurationMonths));

      // Contour
      const contour: ContourType = (opp.contour_type as ContourType) || 'scurve';

      // Distribute weighted hours across months
      const monthlyHours = new Map<string, TradeMonthlyHours>();
      const multipliers = getContourMultipliers(workDurationMonths, contour);
      const monthsUntilStart = Math.max(0, differenceInMonths(projectedStart, now));

      for (let i = 0; i < workDurationMonths; i++) {
        const monthDate = addMonths(now, monthsUntilStart + i);
        const monthKey = format(monthDate, 'yyyy-MM');
        const mult = multipliers[i];

        const pfM = (weightedPf / workDurationMonths) * mult;
        const smM = (weightedSm / workDurationMonths) * mult;
        const plM = (weightedPl / workDurationMonths) * mult;

        const existing = monthlyHours.get(monthKey) || { pf: 0, sm: 0, pl: 0, total: 0 };
        monthlyHours.set(monthKey, {
          pf: existing.pf + pfM,
          sm: existing.sm + smM,
          pl: existing.pl + plM,
          total: existing.total + pfM + smM + plM,
        });
      }

      results.push({
        opportunity: opp,
        projectedStart,
        workDurationMonths,
        contour,
        probability,
        weightedTradeHours: [
          { key: 'pf' as TradeName, remaining: weightedPf },
          { key: 'sm' as TradeName, remaining: weightedSm },
          { key: 'pl' as TradeName, remaining: weightedPl },
        ],
        weightedTotalHours: weightedTotal,
        monthlyHours,
      });
    }

    return results;
  }, [oppMode, opportunitiesWithEstimates, selectedOppIds, locationGroupFilter, locationFilter, forecastRules, oppWeighted]);

  // ─── Aggregations ────────────────────────────────────────

  const columnTotals = useMemo(() => {
    const totals = new Map<string, TradeMonthlyHours>();
    displayColumns.forEach(col => {
      const agg: TradeMonthlyHours = { pf: 0, sm: 0, pl: 0, total: 0 };
      projections.forEach(p => {
        const h = getHoursForColumn(p.monthlyHours, col);
        agg.pf += h.pf; agg.sm += h.sm; agg.pl += h.pl; agg.total += h.total;
      });
      totals.set(col.key, applyTradeFilter(agg));
    });
    return totals;
  }, [projections, displayColumns, getHoursForColumn, tradeFilter]);

  const grandTotalHours = useMemo(() => {
    let total = 0;
    projections.forEach(p => {
      p.tradeHours.forEach(t => { if (tradeFilter.includes(t.key)) total += t.remaining; });
    });
    return total;
  }, [projections, tradeFilter]);

  const grandTotalsByTrade = useMemo(() => {
    const totals = { pf: 0, sm: 0, pl: 0 };
    projections.forEach(p => {
      p.tradeHours.forEach(t => { if (tradeFilter.includes(t.key)) totals[t.key] += t.remaining; });
    });
    return totals;
  }, [projections, tradeFilter]);

  // ─── Opportunity aggregations ─────────────────────────────

  const oppColumnTotals = useMemo(() => {
    const totals = new Map<string, TradeMonthlyHours>();
    displayColumns.forEach(col => {
      const agg: TradeMonthlyHours = { pf: 0, sm: 0, pl: 0, total: 0 };
      opportunityProjections.forEach(p => {
        const h = getHoursForColumn(p.monthlyHours, col);
        agg.pf += h.pf; agg.sm += h.sm; agg.pl += h.pl; agg.total += h.total;
      });
      totals.set(col.key, applyTradeFilter(agg));
    });
    return totals;
  }, [opportunityProjections, displayColumns, getHoursForColumn, tradeFilter]);

  const oppGrandTotalHours = useMemo(() => {
    let total = 0;
    opportunityProjections.forEach(p => {
      p.weightedTradeHours.forEach(t => { if (tradeFilter.includes(t.key)) total += t.remaining; });
    });
    return total;
  }, [opportunityProjections, tradeFilter]);

  // ─── Drill-down data ────────────────────────────────────

  const drillDownProjects = useMemo(() => {
    if (!drillDownCol) return [];
    return projections
      .map(p => {
        const h = getHoursForColumn(p.monthlyHours, drillDownCol);
        return { projection: p, hours: h };
      })
      .filter(d => d.hours.total > 0)
      .sort((a, b) => b.hours.total - a.hours.total);
  }, [drillDownCol, projections, getHoursForColumn]);

  const drillDownOpps = useMemo(() => {
    if (oppMode === 'off' || !drillDownCol) return [];
    return opportunityProjections
      .map(p => {
        const h = getHoursForColumn(p.monthlyHours, drillDownCol);
        return { projection: p, hours: h };
      })
      .filter(d => d.hours.total > 0)
      .sort((a, b) => b.hours.total - a.hours.total);
  }, [drillDownCol, opportunityProjections, oppMode, getHoursForColumn]);

  // Close drill-down when filters change
  useEffect(() => {
    setDrillDownCol(null);
  }, [departmentFilter, locationGroupFilter, marketFilter, pmFilter, statusFilter, searchFilter, projectFilter, locationFilter, timeHorizon, granularity]);

  // ─── Tooltip helper ──────────────────────────────────────

  const cellTooltip = (h: TradeMonthlyHours): string => {
    const hpp = hoursPerPersonPerMonth;
    const fh = applyTradeFilter(h);
    const lines = filteredTrades.map(t => `${t.label}: ${(fh[t.key] / hpp).toFixed(1)} (${fmtHours(fh[t.key])} hrs)`);
    lines.push(`Total: ${(fh.total / hpp).toFixed(1)} (${fmtHours(fh.total)} hrs)`);
    return lines.join('\n');
  };

  // ─── PDF Export ─────────────────────────────────────────

  const handleExportPdf = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const hpp = hoursPerPersonPerMonth;

    // Build filter subtitle
    const filters: string[] = [];
    if (statusFilter === 'Open') filters.push('Open Only');
    else if (statusFilter === 'Soft-Closed') filters.push('Soft-Closed Only');
    if (departmentFilter.length > 0) filters.push(`Dept: ${departmentFilter.join(', ')}`);
    if (locationGroupFilter.length > 0) filters.push(`Location: ${locationGroupFilter.join(', ')}`);
    if (marketFilter) filters.push(`Market: ${marketFilter}`);
    if (pmFilter) filters.push(`PM: ${pmFilter}`);
    if (searchFilter) filters.push(`Search: "${searchFilter}"`);
    if (tradeFilter.length < 3) filters.push(`Trades: ${filteredTrades.map(t => t.label).join(', ')}`);
    if (projectFilter.length > 0) filters.push(`${projectFilter.length} project(s) selected`);
    if (locationFilter !== 'both') filters.push(locationFilter === 'shop' ? 'Shop Only' : 'Field Only');
    if (oppMode !== 'off') filters.push(`+${opportunityProjections.length} opportunities`);

    // Logo (top-right)
    if (logoUrl) {
      try {
        const imgData = await loadImageAsDataUrl(logoUrl);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = imgData;
        });
        const maxW = 80;
        const maxH = 28;
        const aspect = img.width / img.height;
        let drawW = maxW;
        let drawH = drawW / aspect;
        if (drawH > maxH) { drawH = maxH; drawW = drawH * aspect; }
        doc.addImage(imgData, pageWidth - 30 - drawW, 18, drawW, drawH);
      } catch { /* logo not available */ }
    }

    // Header
    let y = 40;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Labor Forecast', 40, y);

    y += 16;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      filters.length > 0 ? filters.join('  |  ') : 'All Open + Soft-Closed',
      40, y
    );

    // Summary KPI strip
    y += 18;
    const peakHC = Math.max(...Array.from(columnTotals.values()).map(h => h.total), 0) / hpp;
    const kpis = [
      { label: 'Projects', value: String(projections.length) },
      { label: 'Total Remaining', value: `${fmtHours(grandTotalHours)} hrs` },
      { label: 'Peak Headcount', value: `${peakHC.toFixed(1)} people` },
      { label: filteredTrades.map(t => t.key.toUpperCase()).join(' / '), value: filteredTrades.map(t => fmtHours(grandTotalsByTrade[t.key])).join(' / ') },
    ];
    const stripWidth = pageWidth - 80;
    const cellW = stripWidth / kpis.length;
    doc.setFillColor(248, 250, 252);
    doc.rect(40, y, stripWidth, 32, 'F');
    kpis.forEach((kpi, i) => {
      const cx = 40 + cellW * i + cellW / 2;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(kpi.label.toUpperCase(), cx, y + 12, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(kpi.value, cx, y + 25, { align: 'center' });
    });
    y += 42;

    // Column headers for time periods — aggregate to quarterly for wide horizons
    const useQuarterly = timeHorizon > 12;
    interface PdfColumn { label: string; keys: string[] }
    let pdfTableColumns: PdfColumn[];
    if (useQuarterly) {
      // Group displayColumns into quarters
      const qMap = new Map<string, PdfColumn>();
      displayColumns.forEach(col => {
        const colDate = new Date(col.key + '-01');
        const qNum = Math.floor(colDate.getMonth() / 3) + 1;
        const qKey = `Q${qNum} ${colDate.getFullYear()}`;
        if (!qMap.has(qKey)) qMap.set(qKey, { label: qKey, keys: [] });
        qMap.get(qKey)!.keys.push(col.key);
      });
      pdfTableColumns = Array.from(qMap.values());
    } else {
      pdfTableColumns = displayColumns.map(c => ({ label: c.label, keys: [c.key] }));
    }
    const colLabels = pdfTableColumns.map(c => c.label);

    // Helper to aggregate hours across multiple month keys
    const aggHours = (hours: Map<string, TradeMonthlyHours>, keys: string[]): TradeMonthlyHours => {
      const agg: TradeMonthlyHours = { pf: 0, sm: 0, pl: 0, total: 0 };
      keys.forEach(k => {
        const h = hours.get(k);
        if (h) { agg.pf += h.pf; agg.sm += h.sm; agg.pl += h.pl; agg.total += h.total; }
      });
      return agg;
    };
    // Helper to aggregate column totals
    const aggColTotals = (totalsMap: Map<string, TradeMonthlyHours>, keys: string[]): TradeMonthlyHours => {
      const agg: TradeMonthlyHours = { pf: 0, sm: 0, pl: 0, total: 0 };
      keys.forEach(k => {
        const h = totalsMap.get(k);
        if (h) { agg.pf += h.pf; agg.sm += h.sm; agg.pl += h.pl; agg.total += h.total; }
      });
      return agg;
    };

    const pgW = doc.internal.pageSize.getWidth();
    const pgH = doc.internal.pageSize.getHeight();

    // Page footer helper
    const drawFooter = () => {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      const footY = pgH - 20;
      doc.text(
        `Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        40, footY
      );
      const pgCount = (doc as any).internal.getNumberOfPages();
      const pgNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
      doc.text(`Page ${pgNum} of ${pgCount}`, pgW - 40, footY, { align: 'right' });
    };

    // ── Chart 1: Stacked Bar Chart — Projected Headcount by Month ──
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Projected Headcount by Month', 40, y + 4);
    y += 16;

    const cLeft = 80;
    const cRight = pgW - 50;
    const cW = cRight - cLeft;
    const cH = 160;
    const cBottom = y + cH;

    const pdfGraphData = displayColumns.map(col => {
      const ct = columnTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
      return { label: col.label, pfHC: ct.pf / hpp, smHC: ct.sm / hpp, plHC: ct.pl / hpp, totalHC: ct.total / hpp };
    });

    let pdfMaxHC = 0;
    pdfGraphData.forEach((d, i) => {
      const oppHC = oppMode !== 'off' ? ((oppColumnTotals.get(displayColumns[i].key)?.total || 0) / hpp) : 0;
      const combined = d.totalHC + oppHC;
      if (combined > pdfMaxHC) pdfMaxHC = combined;
    });
    pdfMaxHC = Math.ceil(pdfMaxHC / 5) * 5;
    if (pdfMaxHC === 0) pdfMaxHC = 10;

    // Y-axis gridlines
    for (let i = 0; i <= 5; i++) {
      const yVal = (pdfMaxHC / 5) * i;
      const yPos = cBottom - (i / 5) * cH;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(cLeft, yPos, cRight, yPos);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(yVal.toFixed(0), cLeft - 5, yPos + 2, { align: 'right' });
    }
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('People', cLeft - 5, y - 4, { align: 'right' });

    // Stacked bars
    const pdfBarCount = pdfGraphData.length;
    const pdfBarW = Math.min(cW / pdfBarCount * 0.75, 20);
    const pdfBarGap = cW / pdfBarCount;
    const tColors: Array<[number, number, number]> = [[59, 130, 246], [16, 185, 129], [245, 158, 11]];

    pdfGraphData.forEach((d, i) => {
      const bx = cLeft + i * pdfBarGap + (pdfBarGap - pdfBarW) / 2;
      const plBarH = pdfMaxHC > 0 ? (d.plHC / pdfMaxHC) * cH : 0;
      const smBarH = pdfMaxHC > 0 ? (d.smHC / pdfMaxHC) * cH : 0;
      const pfBarH = pdfMaxHC > 0 ? (d.pfHC / pdfMaxHC) * cH : 0;

      if (plBarH > 0.5) {
        doc.setFillColor(tColors[2][0], tColors[2][1], tColors[2][2]);
        doc.rect(bx, cBottom - plBarH, pdfBarW, plBarH, 'F');
      }
      if (smBarH > 0.5) {
        doc.setFillColor(tColors[1][0], tColors[1][1], tColors[1][2]);
        doc.rect(bx, cBottom - plBarH - smBarH, pdfBarW, smBarH, 'F');
      }
      if (pfBarH > 0.5) {
        doc.setFillColor(tColors[0][0], tColors[0][1], tColors[0][2]);
        doc.rect(bx, cBottom - plBarH - smBarH - pfBarH, pdfBarW, pfBarH, 'F');
      }

      // Opportunity overlay bar with diagonal hatch pattern
      if (oppMode !== 'off') {
        const ot = oppColumnTotals.get(displayColumns[i].key) || { pf: 0, sm: 0, pl: 0, total: 0 };
        const oppHC = ot.total / hpp;
        const oppBarH = pdfMaxHC > 0 ? (oppHC / pdfMaxHC) * cH : 0;
        if (oppBarH > 0.5) {
          const committedH = plBarH + smBarH + pfBarH;
          const oppY = cBottom - committedH - oppBarH;

          // Light orange fill background with border
          doc.setFillColor(255, 251, 235);
          doc.setDrawColor(245, 158, 11);
          doc.setLineWidth(0.3);
          doc.rect(bx, oppY, pdfBarW, oppBarH, 'FD');

          // Draw diagonal hatch lines clipped to bar area
          doc.saveGraphicsState();
          // Build clip path using moveTo/lineTo
          (doc as any).moveTo(bx, oppY);
          (doc as any).lineTo(bx + pdfBarW, oppY);
          (doc as any).lineTo(bx + pdfBarW, oppY + oppBarH);
          (doc as any).lineTo(bx, oppY + oppBarH);
          (doc as any).clip();
          (doc as any).discardPath();
          doc.setDrawColor(245, 158, 11);
          doc.setLineWidth(0.5);
          const hatchSpacing = 3;
          for (let h = -oppBarH; h < pdfBarW + oppBarH; h += hatchSpacing) {
            doc.line(bx + h, oppY + oppBarH, bx + h + oppBarH, oppY);
          }
          doc.restoreGraphicsState();
        }
      }

      const pdfLabelEvery = pdfBarCount <= 12 ? 1 : pdfBarCount <= 18 ? 2 : 3;
      if (i % pdfLabelEvery === 0) {
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(d.label, bx + pdfBarW / 2, cBottom + 10, { align: 'center' });
      }
    });

    // Legend
    const lgY = cBottom + 20;
    let lgX = cLeft;
    filteredTrades.forEach((trade, ti) => {
      const colorIdx = TRADES.findIndex(t => t.key === trade.key);
      doc.setFillColor(tColors[colorIdx][0], tColors[colorIdx][1], tColors[colorIdx][2]);
      doc.rect(lgX, lgY - 4, 10, 6, 'F');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(trade.label, lgX + 13, lgY + 1);
      lgX += 70;
    });
    if (oppMode !== 'off') {
      // Hatched legend swatch matching the bar style
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.3);
      doc.rect(lgX, lgY - 4, 10, 6, 'FD');
      doc.saveGraphicsState();
      (doc as any).moveTo(lgX, lgY - 4);
      (doc as any).lineTo(lgX + 10, lgY - 4);
      (doc as any).lineTo(lgX + 10, lgY + 2);
      (doc as any).lineTo(lgX, lgY + 2);
      (doc as any).clip();
      (doc as any).discardPath();
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.5);
      for (let h = -6; h < 16; h += 2.5) {
        doc.line(lgX + h, lgY + 2, lgX + h + 6, lgY - 4);
      }
      doc.restoreGraphicsState();
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Opportunities', lgX + 13, lgY + 1);
      lgX += 70;
    }

    // ── Chart 2: Trade Breakdown Horizontal Bars ──
    y = lgY + 25;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Total Remaining Hours by Trade', 40, y);
    y += 12;

    const mxTradeHrs = Math.max(...filteredTrades.map(t => grandTotalsByTrade[t.key]), 1);
    // Measure longest label text to reserve space on the right
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    let maxLabelW = 0;
    filteredTrades.forEach((trade) => {
      const hrs = grandTotalsByTrade[trade.key];
      const lbl = `${fmtHours(hrs)} hrs (${(hrs / hpp).toFixed(0)} person-months)`;
      const tw = doc.getTextWidth(lbl);
      if (tw > maxLabelW) maxLabelW = tw;
    });
    const hbMaxW = cW - 80 - maxLabelW - 15; // 80 for trade name, 15 for padding

    filteredTrades.forEach((trade) => {
      const hrs = grandTotalsByTrade[trade.key];
      const bw = (hrs / mxTradeHrs) * hbMaxW;
      const colorIdx = TRADES.findIndex(t => t.key === trade.key);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(tColors[colorIdx][0], tColors[colorIdx][1], tColors[colorIdx][2]);
      doc.text(trade.label, cLeft, y + 8);

      doc.setFillColor(226, 232, 240);
      doc.rect(cLeft + 70, y, hbMaxW, 12, 'F');
      if (bw > 0) {
        doc.setFillColor(tColors[colorIdx][0], tColors[colorIdx][1], tColors[colorIdx][2]);
        doc.rect(cLeft + 70, y, Math.max(bw, 2), 12, 'F');
      }

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(`${fmtHours(hrs)} hrs (${(hrs / hpp).toFixed(0)} person-months)`, cRight, y + 8, { align: 'right' });
      y += 18;
    });

    // ── Chart 3: Quarterly Summary (compact row) ──
    y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Projected Headcount by Quarter', 40, y);
    y += 14;

    const qNow = startOfMonth(new Date());
    const pdfQuarters: { label: string; total: number }[] = [];
    for (let q = 0; q < 8; q++) {
      const sm = q * 3;
      let total = 0;
      for (let m = 0; m < 3; m++) {
        const monthDate = addMonths(qNow, sm + m);
        const key = format(monthDate, 'yyyy-MM');
        projections.forEach(p => {
          const h = p.monthlyHours.get(key);
          if (h) { const fh = applyTradeFilter(h); total += fh.total; }
        });
      }
      const avgHC = (total / 3) / hpp;
      const qStart = addMonths(qNow, sm);
      const qNum = Math.floor(qStart.getMonth() / 3) + 1;
      pdfQuarters.push({ label: `Q${qNum} ${qStart.getFullYear()}`, total: avgHC });
    }

    const qbW = Math.min((pgW - 80) / pdfQuarters.length - 4, 80);
    const qbH = 32;
    pdfQuarters.forEach((q, i) => {
      const qx = 40 + i * (qbW + 4);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.rect(qx, y, qbW, qbH, 'FD');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(q.label, qx + qbW / 2, y + 10, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(q.total > 0 ? q.total.toFixed(1) : '-', qx + qbW / 2, y + 22, { align: 'center' });

      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('avg people', qx + qbW / 2, y + 29, { align: 'center' });
    });

    // ── Trade Summary Table (same page, below charts) ──
    y += qbH + 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`Trade Summary${useQuarterly ? ' (Quarterly Hours)' : ''}`, 40, y + 4);
    y += 12;

    const tradeHeaders = ['Trade', 'Remaining Hours', ...colLabels];
    const tradeEntries: { key: string; label: string }[] = [
      ...filteredTrades.map(t => ({ key: t.key, label: t.label })),
      { key: 'total', label: 'TOTAL' },
    ];
    const tradeRows = tradeEntries.map(trade => {
      const remaining = trade.key === 'total'
        ? fmtHours(grandTotalHours)
        : fmtHours(grandTotalsByTrade[trade.key as TradeName] || 0);
      const periodCols = pdfTableColumns.map(pc => {
        const ct = aggColTotals(columnTotals, pc.keys);
        const hours = trade.key === 'total' ? ct.total : ct[trade.key as TradeName] || 0;
        return useQuarterly ? fmtHours(hours) : fmtHeadcount(hours, hpp);
      });
      return [trade.label, remaining, ...periodCols];
    });

    autoTable(doc, {
      startY: y,
      head: [tradeHeaders],
      body: tradeRows,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 7, cellPadding: 4, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 70 },
        1: { halign: 'right', cellWidth: 75 },
        ...Object.fromEntries(colLabels.map((_, i) => [i + 2, { halign: 'right' as const }])),
      },
      didParseCell: (data: any) => {
        // Bold the TOTAL row
        if (data.section === 'body' && data.row.index === filteredTrades.length) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      },
      didDrawPage: () => { drawFooter(); },
    });

    // ── Project Detail Table (new page) ──
    doc.addPage();
    y = 40;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`Project Detail${useQuarterly ? ' (Quarterly Hours)' : ''}`, 40, y + 4);
    y += 12;

    const pdfNow = startOfMonth(new Date());
    const tradeColHeaders = filteredTrades.map(t => t.key.toUpperCase());
    const projHeaders = ['Contract', 'Description', 'PM', 'Dept', 'Rem. Hrs', ...tradeColHeaders, '% Comp', 'Start', 'End', ...colLabels];
    const projRows = projections.map(p => {
      const desc = (p.contract.description || p.contract.customer_name || '-').substring(0, 30);
      const pm = (p.contract.project_manager_name || '-').split(',')[0].substring(0, 15);
      const periodCols = pdfTableColumns.map(pc => {
        const h = applyTradeFilter(aggHours(p.monthlyHours, pc.keys));
        return useQuarterly ? fmtHours(h.total) : fmtHeadcount(h.total, hpp);
      });
      const filteredRemaining = p.tradeHours.filter(t => tradeFilter.includes(t.key)).reduce((s, t) => s + t.remaining, 0);
      return [
        p.contract.contract_number || '',
        desc,
        pm,
        p.contract.department_code || '-',
        fmtHours(filteredRemaining),
        ...filteredTrades.map(t => fmtHours(p.tradeHours.find(th => th.key === t.key)?.remaining || 0)),
        p.pctComplete > 0 ? `${p.pctComplete.toFixed(0)}%` : '-',
        format(addMonths(pdfNow, p.startOffset), 'MMM yy'),
        format(addMonths(pdfNow, p.startOffset + p.remainingMonths), 'MMM yy'),
        ...periodCols,
      ];
    });

    // Add opportunity rows if active
    if (oppMode !== 'off' && opportunityProjections.length > 0) {
      projRows.push(['', '', '', '', '', ...filteredTrades.map(() => ''), '', '', '', ...colLabels.map(() => '')]);  // spacer
      opportunityProjections.forEach(p => {
        const periodCols = pdfTableColumns.map(pc => {
          const h = applyTradeFilter(aggHours(p.monthlyHours, pc.keys));
          return useQuarterly ? fmtHours(h.total) : fmtHeadcount(h.total, hpp);
        });
        const filteredRemaining = p.weightedTradeHours.filter(t => tradeFilter.includes(t.key)).reduce((s, t) => s + t.remaining, 0);
        projRows.push([
          'OPP',
          `${p.opportunity.title} (${p.probability}%)`.substring(0, 35),
          '-',
          p.opportunity.location_group || '-',
          fmtHours(filteredRemaining),
          ...filteredTrades.map(t => fmtHours(p.weightedTradeHours.find(th => th.key === t.key)?.remaining || 0)),
          '-',
          format(p.projectedStart, 'MMM yy'),
          format(addMonths(p.projectedStart, p.workDurationMonths), 'MMM yy'),
          ...periodCols,
        ]);
      });
    }

    autoTable(doc, {
      startY: y,
      head: [projHeaders],
      body: projRows,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 6.5, cellPadding: 3, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold', fontSize: 6.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: 'left', cellWidth: 48 },   // Contract
        1: { halign: 'left', cellWidth: 75 },    // Description
        2: { halign: 'left', cellWidth: 48 },     // PM
        3: { halign: 'center', cellWidth: 26 },   // Dept
        4: { halign: 'right', cellWidth: 36 },    // Rem. Hrs
        ...Object.fromEntries(filteredTrades.map((_, i) => [5 + i, { halign: 'right' as const, cellWidth: 26 }])),
        [5 + filteredTrades.length]: { halign: 'right', cellWidth: 28 },    // % Comp
        [6 + filteredTrades.length]: { halign: 'center', cellWidth: 32 },   // Start
        [7 + filteredTrades.length]: { halign: 'center', cellWidth: 32 },   // End
        ...Object.fromEntries(colLabels.map((_, i) => [i + 8 + filteredTrades.length, { halign: 'right' as const }])),
      },
      didParseCell: (data: any) => {
        // Highlight opportunity rows with amber
        if (data.section === 'body' && data.row.raw && data.row.raw[0] === 'OPP') {
          data.cell.styles.textColor = [146, 64, 14];
          data.cell.styles.fillColor = [255, 251, 235];
        }
      },
      didDrawPage: (data: any) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        const footerY = doc.internal.pageSize.getHeight() - 20;
        doc.text(
          `Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          40, footerY
        );
        doc.text(`Page ${pageNum} of ${pageCount}`, pageWidth - 40, footerY, { align: 'right' });
      },
    });

    doc.save(`Labor_Forecast_${new Date().toISOString().slice(0, 10)}.pdf`);
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
            {locationFilter !== 'both' && (
              <span style={{ color: '#dc2626', fontWeight: 500 }}>
                {' '}| {locationFilter === 'shop' ? 'Shop Only' : 'Field Only'}
              </span>
            )}
            {oppMode !== 'off' && opportunityProjections.length > 0 && (
              <span style={{ color: '#f59e0b', fontWeight: 500 }}>
                {' '}| +{opportunityProjections.length} opportunities ({fmtHours(oppGrandTotalHours)} hrs{oppWeighted ? ' weighted' : ''})
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className={myProjectsOnly ? 'sales-btn sales-btn-primary' : 'sales-btn sales-btn-secondary'}
            onClick={() => { setMyProjectsOnly(!myProjectsOnly); if (!myProjectsOnly) setMyTeamOnly(false); }}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            My Projects
          </button>
          <button
            className={myTeamOnly ? 'sales-btn sales-btn-primary' : 'sales-btn sales-btn-secondary'}
            onClick={() => { setMyTeamOnly(!myTeamOnly); if (!myTeamOnly) setMyProjectsOnly(false); }}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
            title="Filter to my team members"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            My Team
          </button>
          <button
            className="sales-btn sales-btn-secondary"
            onClick={() => navigate('/projects/projected-revenue')}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
            </svg>
            Projected Revenue
          </button>
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
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '130px' }}
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
            <MultiSearchableSelect
              options={filterOptions.departments.map(d => ({ value: d, label: d }))}
              value={departmentFilter}
              onChange={setDepartmentFilter}
              placeholder="All Depts"
              style={{ minWidth: '120px', fontSize: '0.8rem' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Location</label>
            <MultiSearchableSelect
              options={LOCATION_GROUPS.map(g => ({ value: g.label, label: g.label }))}
              value={locationGroupFilter}
              onChange={setLocationGroupFilter}
              placeholder="All Locations"
              style={{ minWidth: '120px', fontSize: '0.8rem' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Trade</label>
            <MultiSearchableSelect
              options={TRADES.map(t => ({ value: t.key, label: t.label }))}
              value={tradeFilter}
              onChange={(vals: string[]) => setTradeFilter(vals.length > 0 ? vals as TradeName[] : ['pf', 'sm', 'pl'])}
              placeholder="All Trades"
              style={{ minWidth: '120px', fontSize: '0.8rem' }}
            />
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
            <SearchableSelect
              options={filterOptions.pms.map(pm => ({ value: pm, label: pm }))}
              value={pmFilter}
              onChange={setPmFilter}
              placeholder="All PMs"
              style={{ minWidth: '180px', fontSize: '0.8rem' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Project</label>
            <MultiSearchableSelect
              options={projectOptions}
              value={projectFilter}
              onChange={setProjectFilter}
              placeholder="All Projects"
              style={{ minWidth: '200px', fontSize: '0.8rem' }}
            />
          </div>

          {(searchFilter || departmentFilter.length > 0 || locationGroupFilter.length > 0 || tradeFilter.length < 3 || marketFilter || pmFilter || projectFilter.length > 0 || statusFilter !== 'all' || locationFilter !== 'both' || myProjectsOnly || myTeamOnly) && (
            <button
              onClick={() => { setSearchFilter(''); setDepartmentFilter([]); setLocationGroupFilter([]); setTradeFilter(['pf', 'sm', 'pl']); setMarketFilter(''); setPmFilter(''); setProjectFilter([]); setStatusFilter('all'); setLocationFilter('both'); setMyProjectsOnly(false); setMyTeamOnly(false); }}
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
            <button
              onClick={handleExportPdf}
              style={{
                padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                background: '#f1f5f9', color: '#64748b',
                border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.25rem'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              Export PDF
            </button>

            {/* Time horizon toggle */}
            <div style={{ display: 'flex', gap: '0' }}>
              {[3, 6, 12, 18, 24, 36].map((months, i, arr) => (
                <button
                  key={months}
                  onClick={() => { setTimeHorizon(months); if (months > 12) setGranularity('monthly'); }}
                  style={{
                    padding: '0.35rem 0.5rem', fontSize: '0.75rem',
                    background: timeHorizon === months ? '#059669' : '#f1f5f9',
                    color: timeHorizon === months ? '#fff' : '#64748b',
                    border: '1px solid #e2e8f0',
                    borderRadius: i === 0 ? '4px 0 0 4px' : i === arr.length - 1 ? '0 4px 4px 0' : '0',
                    cursor: 'pointer', minWidth: '36px',
                  }}
                >
                  {months}mo
                </button>
              ))}
            </div>

            {/* Granularity toggle (only for ≤12 month horizons) */}
            {timeHorizon <= 12 && (
              <div style={{ display: 'flex', gap: '0' }}>
                <button
                  onClick={() => setGranularity('monthly')}
                  style={{
                    padding: '0.35rem 0.5rem', fontSize: '0.75rem',
                    background: granularity === 'monthly' ? '#0284c7' : '#f1f5f9',
                    color: granularity === 'monthly' ? '#fff' : '#64748b',
                    border: '1px solid #e2e8f0', borderRadius: '4px 0 0 4px', cursor: 'pointer',
                  }}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setGranularity('weekly')}
                  style={{
                    padding: '0.35rem 0.5rem', fontSize: '0.75rem',
                    background: granularity === 'weekly' ? '#0284c7' : '#f1f5f9',
                    color: granularity === 'weekly' ? '#fff' : '#64748b',
                    border: '1px solid #e2e8f0', borderRadius: '0 4px 4px 0', cursor: 'pointer',
                  }}
                >
                  Weekly
                </button>
              </div>
            )}

            {/* Shop/Field location filter */}
            <div style={{ display: 'flex', gap: '0' }}>
              {([
                { value: 'both' as const, label: 'All' },
                { value: 'field' as const, label: 'Field' },
                { value: 'shop' as const, label: 'Shop' },
              ]).map((opt, i, arr) => (
                <button
                  key={opt.value}
                  onClick={() => setLocationFilter(opt.value)}
                  style={{
                    padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                    background: locationFilter === opt.value ? '#dc2626' : '#f1f5f9',
                    color: locationFilter === opt.value ? '#fff' : '#64748b',
                    border: '1px solid #e2e8f0',
                    borderRadius: i === 0 ? '4px 0 0 4px' : i === arr.length - 1 ? '0 4px 4px 0' : '0',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

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

      {/* Opportunities Overlay Toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '0.5rem 1rem', marginBottom: '0.75rem',
        background: oppMode !== 'off' ? '#fffbeb' : '#f8fafc',
        border: `1px solid ${oppMode !== 'off' ? '#fcd34d' : '#e2e8f0'}`,
        borderRadius: '8px',
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: oppMode !== 'off' ? '#92400e' : '#64748b' }}>
          Pipeline Opportunities
        </span>
        <div style={{ display: 'flex', gap: '0' }}>
          {(['off', 'all', 'select'] as const).map((mode, i, arr) => (
            <button
              key={mode}
              onClick={() => { setOppMode(mode); if (mode === 'off') setSelectedOppIds([]); }}
              style={{
                padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                background: oppMode === mode ? '#f59e0b' : '#fff',
                color: oppMode === mode ? '#fff' : '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: i === 0 ? '4px 0 0 4px' : i === arr.length - 1 ? '0 4px 4px 0' : '0',
                cursor: 'pointer', fontWeight: oppMode === mode ? 600 : 400,
              }}
            >
              {mode === 'off' ? 'Off' : mode === 'all' ? 'All Opps' : 'Select...'}
            </button>
          ))}
        </div>
        {oppMode === 'select' && opportunitiesWithEstimates && (
          <MultiSearchableSelect
            options={opportunitiesWithEstimates
              .filter(o => locationGroupFilter.length === 0 || (o.location_group && locationGroupFilter.includes(o.location_group)))
              .map(o => ({
              value: String(o.id),
              label: `${o.title} (${fmtCompact(parseNum(o.estimated_value))})${o.stage_name === 'Awarded' ? ' [Awarded]' : ''}`,
              searchText: `${o.title} ${o.customer_name || ''} ${o.location_group || ''} ${o.stage_name || ''}`,
            }))}
            value={selectedOppIds.map(String)}
            onChange={(vals: string[]) => setSelectedOppIds(vals.map(Number))}
            placeholder="Select opportunities..."
            style={{ minWidth: '280px', fontSize: '0.75rem' }}
          />
        )}
        {oppMode !== 'off' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.75rem', color: '#92400e' }}>
            <input
              type="checkbox"
              checked={oppWeighted}
              onChange={(e) => setOppWeighted(e.target.checked)}
              style={{ accentColor: '#f59e0b' }}
            />
            Probability weighted
          </label>
        )}
        {oppMode !== 'off' && opportunityProjections.length > 0 && (
          <span style={{ fontSize: '0.75rem', color: '#92400e', marginLeft: 'auto' }}>
            {opportunityProjections.length} opportunities | {fmtHours(oppGrandTotalHours)} {oppWeighted ? 'weighted' : 'actual'} hrs
          </span>
        )}
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
                      <th
                        onClick={() => handleSort('project')}
                        style={{
                          padding: '0.5rem',
                          textAlign: 'left',
                          borderBottom: '2px solid #e2e8f0',
                          position: 'sticky',
                          left: 0,
                          background: '#f8fafc',
                          minWidth: '200px',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        Project<SortIndicator column="project" />
                      </th>
                      <th
                        onClick={() => handleSort('hours')}
                        style={{
                          padding: '0.5rem',
                          textAlign: 'right',
                          borderBottom: '2px solid #e2e8f0',
                          minWidth: '80px',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        Rem. Hours<SortIndicator column="hours" />
                      </th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '110px' }}>PF / SM / PL</th>
                      <th
                        onClick={() => handleSort('completion')}
                        style={{
                          padding: '0.5rem',
                          textAlign: 'right',
                          borderBottom: '2px solid #e2e8f0',
                          minWidth: '50px',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        % Comp<SortIndicator column="completion" />
                      </th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '60px' }}>Start</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '60px' }}>End</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '80px' }}>Contour</th>
                    </>
                  ) : (
                    <>
                      <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', position: 'sticky', left: 0, background: '#f8fafc', minWidth: '140px' }}>Trade</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', minWidth: '90px' }}>Total Remaining</th>
                    </>
                  )}
                  {displayColumns.map(col => (
                    <th key={col.key} style={{
                      padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0',
                      minWidth: granularity === 'weekly' ? '40px' : '55px', background: '#f8fafc',
                      fontSize: granularity === 'weekly' ? '0.6rem' : '0.75rem',
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
                          value={p.startOffset}
                          onChange={(e) => {
                            const newStart = parseInt(e.target.value);
                            setAdjustedStartMonths(prev => ({ ...prev, [p.contract.id]: newStart }));
                            saveProjectionOverride(p.contract.id, { user_adjusted_start_months: newStart });
                            // Auto-bump end if start >= end
                            const currentEnd = p.startOffset + p.remainingMonths;
                            if (newStart >= currentEnd) {
                              const newEnd = newStart + 1;
                              setAdjustedEndMonths(prev => ({ ...prev, [p.contract.id]: newEnd }));
                              saveProjectionOverride(p.contract.id, { user_adjusted_start_months: newStart, user_adjusted_end_months: newEnd });
                            }
                          }}
                          style={{
                            padding: '0.15rem 0.25rem', fontSize: '0.65rem',
                            border: adjustedStartMonths[p.contract.id] !== undefined ? '1px solid #16a34a' : '1px solid #e2e8f0',
                            borderRadius: '3px',
                            background: adjustedStartMonths[p.contract.id] !== undefined ? '#dcfce7' : 'transparent',
                            color: adjustedStartMonths[p.contract.id] !== undefined ? '#15803d' : '#64748b',
                            cursor: 'pointer', width: '65px'
                          }}
                        >
                          {Array.from({ length: 36 }, (_, i) => i).map(m => (
                            <option key={m} value={m}>{format(addMonths(startOfMonth(new Date()), m), 'MMM yy')}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.65rem' }}>
                        <select
                          value={p.startOffset + p.remainingMonths}
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
                          {Array.from({ length: 36 }, (_, i) => i + 1).filter(m => m > p.startOffset).map(m => (
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
                      {displayColumns.map(col => {
                        const h = applyTradeFilter(getHoursForColumn(p.monthlyHours, col));
                        return (
                          <td key={col.key} title={h.total > 0 ? cellTooltip(h) : ''}
                            style={{
                              padding: '0.4rem 0.5rem', textAlign: 'right',
                              color: h.total > 0 ? '#1e293b' : '#cbd5e1',
                              fontWeight: h.total > 0 ? 500 : 400,
                              fontSize: granularity === 'weekly' ? '0.65rem' : '0.75rem',
                            }}>
                            {fmtHeadcount(h.total, hoursPerPersonPerMonth)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  /* ─── TRADE SUMMARY ROWS ─── */
                  [...filteredTrades, { key: 'total' as any, label: 'TOTAL', color: '#1e293b' }].map((trade) => (
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
                      {displayColumns.map(col => {
                        const ct = columnTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
                        const hours = trade.key === 'total' ? ct.total : ct[trade.key as TradeName] || 0;
                        return (
                          <td key={col.key}
                            onClick={() => hours > 0 && setDrillDownCol({ key: col.key, label: col.label, monthKey: col.monthKey })}
                            title={hours > 0 ? `${(hours / hoursPerPersonPerMonth).toFixed(1)} people (${fmtHours(hours)} hrs) — click for details` : ''}
                            style={{
                              padding: '0.5rem', textAlign: 'right',
                              color: hours > 0 ? '#1e293b' : '#cbd5e1',
                              fontWeight: hours > 0 ? 500 : 400,
                              background: trade.key === 'total' ? '#f1f5f9' : 'transparent',
                              fontSize: granularity === 'weekly' ? '0.65rem' : '0.75rem',
                              cursor: hours > 0 ? 'pointer' : 'default',
                            }}>
                            {fmtHeadcount(hours, hoursPerPersonPerMonth)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
                {/* ─── OPPORTUNITY ROWS (both views) ─── */}
                {oppMode !== 'off' && opportunityProjections.length > 0 && dataView === 'project' && (
                  <>
                    <tr style={{ borderTop: '2px dashed #f59e0b', background: '#fffbeb' }}>
                      <td colSpan={7 + displayColumns.length} style={{ padding: '0.4rem 0.5rem', position: 'sticky', left: 0, background: '#fffbeb', color: '#b45309', fontWeight: 600, fontSize: '0.7rem' }}>
                        + Opportunities ({opportunityProjections.length}) — {oppWeighted ? 'probability-weighted' : 'actual'} hours
                      </td>
                    </tr>
                    {opportunityProjections.map(p => (
                      <tr key={`opp-${p.opportunity.id}`} style={{ borderBottom: '1px solid #fde68a', background: '#fffbeb', borderLeft: '3px solid #f59e0b' }}>
                        <td style={{ padding: '0.4rem 0.5rem', position: 'sticky', left: 0, background: '#fffbeb' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ background: '#f59e0b', color: '#fff', fontSize: '0.55rem', padding: '1px 4px', borderRadius: '3px', fontWeight: 600 }}>OPP</span>
                            <div>
                              <div style={{ fontWeight: 500, fontSize: '0.75rem', color: '#92400e' }}>{p.opportunity.title}</div>
                              <div style={{ fontSize: '0.6rem', color: '#b45309' }}>
                                {fmtCompact(parseNum(p.opportunity.estimated_value))}
                                {' | '}{p.probability}% prob
                                {p.opportunity.location_group && ` | ${p.opportunity.location_group}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 500, color: '#92400e' }}>
                          {fmtHours(p.weightedTotalHours)}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.65rem' }}>
                          <span style={{ color: TRADES[0].color }}>{fmtHours(p.weightedTradeHours[0].remaining)}</span>
                          {' / '}
                          <span style={{ color: TRADES[1].color }}>{fmtHours(p.weightedTradeHours[1].remaining)}</span>
                          {' / '}
                          <span style={{ color: TRADES[2].color }}>{fmtHours(p.weightedTradeHours[2].remaining)}</span>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#b45309' }}>-</td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.65rem', color: '#b45309' }}>
                          {format(p.projectedStart, 'MMM yy')}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.65rem', color: '#b45309' }}>
                          {format(addMonths(p.projectedStart, p.workDurationMonths), 'MMM yy')}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                          <ContourVisual contour={p.contour} />
                        </td>
                        {displayColumns.map(col => {
                          const h = applyTradeFilter(getHoursForColumn(p.monthlyHours, col));
                          return (
                            <td key={col.key} style={{
                              padding: '0.4rem 0.5rem', textAlign: 'right',
                              color: h.total > 0 ? '#92400e' : '#fcd34d',
                              fontWeight: h.total > 0 ? 500 : 400,
                              fontSize: granularity === 'weekly' ? '0.65rem' : '0.75rem',
                            }}>
                              {fmtHeadcount(h.total, hoursPerPersonPerMonth)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                )}
                {/* ─── OPPORTUNITY DELTA ROW (By Trade view) ─── */}
                {oppMode !== 'off' && oppGrandTotalHours > 0 && dataView === 'trade' && (
                  <>
                    <tr style={{ borderTop: '2px dashed #f59e0b', background: '#fffbeb' }}>
                      <td style={{ padding: '0.5rem', position: 'sticky', left: 0, background: '#fffbeb', borderLeft: '3px solid #f59e0b' }}>
                        <span style={{ fontWeight: 600, color: '#b45309', fontSize: '0.75rem' }}>
                          + Opps ({opportunityProjections.length})
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500, color: '#b45309' }}>
                        {fmtHours(oppGrandTotalHours)}
                      </td>
                      {displayColumns.map(col => {
                        const ot = oppColumnTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
                        return (
                          <td key={col.key} style={{
                            padding: '0.5rem', textAlign: 'right',
                            color: ot.total > 0 ? '#b45309' : '#fcd34d',
                            fontWeight: ot.total > 0 ? 500 : 400,
                            background: '#fffbeb',
                            fontSize: granularity === 'weekly' ? '0.65rem' : '0.75rem',
                          }}>
                            {fmtHeadcount(ot.total, hoursPerPersonPerMonth)}
                          </td>
                        );
                      })}
                    </tr>
                    <tr style={{ background: '#fef3c7' }}>
                      <td style={{ padding: '0.5rem', position: 'sticky', left: 0, background: '#fef3c7' }}>
                        <span style={{ fontWeight: 700, color: '#92400e', fontSize: '0.75rem' }}>COMBINED TOTAL</span>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: '#92400e' }}>
                        {fmtHours(grandTotalHours + oppGrandTotalHours)}
                      </td>
                      {displayColumns.map(col => {
                        const ct = columnTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
                        const ot = oppColumnTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
                        const combined = ct.total + ot.total;
                        return (
                          <td key={col.key} style={{
                            padding: '0.5rem', textAlign: 'right',
                            color: combined > 0 ? '#92400e' : '#fcd34d',
                            fontWeight: 700,
                            background: '#fef3c7',
                            fontSize: granularity === 'weekly' ? '0.65rem' : '0.75rem',
                          }}>
                            {fmtHeadcount(combined, hoursPerPersonPerMonth)}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                )}
              </tbody>
              {dataView === 'project' && (
                <tfoot>
                  <tr style={{ background: '#f1f5f9', fontWeight: 600 }}>
                    <td style={{ padding: '0.5rem', position: 'sticky', left: 0, background: '#f1f5f9' }}>
                      TOTAL ({projections.length} projects{oppMode !== 'off' && opportunityProjections.length > 0 && ` + ${opportunityProjections.length} opps`})
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{fmtHours(grandTotalHours + (oppMode !== 'off' ? oppGrandTotalHours : 0))}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.65rem' }}>
                      {filteredTrades.map((t, i) => (
                        <span key={t.key}>
                          {i > 0 && ' / '}
                          <span style={{ color: t.color }}>{fmtHours(grandTotalsByTrade[t.key])}</span>
                        </span>
                      ))}
                    </td>
                    <td style={{ padding: '0.5rem' }}>-</td>
                    <td style={{ padding: '0.5rem' }}>-</td>
                    <td style={{ padding: '0.5rem' }}>-</td>
                    {displayColumns.map(col => {
                      const ct = columnTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
                      const ot = oppMode !== 'off' ? (oppColumnTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 }) : { pf: 0, sm: 0, pl: 0, total: 0 };
                      const combined = { pf: ct.pf + ot.pf, sm: ct.sm + ot.sm, pl: ct.pl + ot.pl, total: ct.total + ot.total };
                      return (
                        <td key={col.key} title={combined.total > 0 ? cellTooltip(combined) : ''}
                          style={{ padding: '0.5rem', textAlign: 'right', background: '#f1f5f9', fontSize: granularity === 'weekly' ? '0.65rem' : '0.75rem' }}>
                          {fmtHeadcount(combined.total, hoursPerPersonPerMonth)}
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
              {filteredTrades.map(t => (
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
          {/* Stacked bar chart */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
              Projected Headcount by {granularity === 'weekly' && timeHorizon <= 12 ? 'Week' : 'Month'} (Next {timeHorizon} Months)
            </h3>
            <div style={{ height: '320px', position: 'relative' }}>
              {(() => {
                const barCount = displayColumns.length;
                const graphData = displayColumns.map(col => {
                  const ct = columnTotals.get(col.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
                  return { label: col.label, key: col.key, monthKey: col.monthKey, ...ct };
                });

                let maxValue = 0;
                graphData.forEach(d => {
                  const contractHC = d.total / hoursPerPersonPerMonth;
                  const oppHC = oppMode !== 'off' ? ((oppColumnTotals.get(d.key)?.total || 0) / hoursPerPersonPerMonth) : 0;
                  const combined = contractHC + oppHC;
                  if (combined > maxValue) maxValue = combined;
                });
                maxValue = Math.ceil(maxValue / 5) * 5;
                if (maxValue === 0) maxValue = 10;

                const barWidth = 100 / barCount;
                const chartHeight = 250;
                const isWeekly = granularity === 'weekly' && timeHorizon <= 12;

                // Boundaries: month boundaries for weekly, year boundaries for monthly
                const boundaries: { index: number; label: string }[] = [];
                if (isWeekly) {
                  let lastMonth = '';
                  graphData.forEach((d, i) => {
                    if (d.monthKey !== lastMonth) {
                      boundaries.push({ index: i, label: format(new Date(d.monthKey + '-01'), 'MMM yy') });
                      lastMonth = d.monthKey;
                    }
                  });
                } else {
                  graphData.forEach((d, i) => {
                    if (d.key.endsWith('-01')) boundaries.push({ index: i, label: d.key.substring(0, 4) });
                  });
                }

                // Label frequency
                const labelEvery = isWeekly
                  ? (barCount <= 13 ? 1 : barCount <= 26 ? 2 : 4)
                  : (barCount <= 12 ? 1 : barCount <= 18 ? 2 : 3);

                return (
                  <svg width="100%" height={chartHeight + 50} style={{ overflow: 'visible' }}>
                    {oppMode !== 'off' && (
                      <defs>
                        <pattern id="opp-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
                          <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(245,158,11,0.7)" strokeWidth="2" />
                        </pattern>
                      </defs>
                    )}
                    {/* Y-axis */}
                    <text x="0" y="10" fontSize="10" fill="#64748b">{maxValue} ppl</text>
                    <text x="0" y={chartHeight / 2} fontSize="10" fill="#64748b">{(maxValue / 2).toFixed(0)}</text>
                    <text x="0" y={chartHeight} fontSize="10" fill="#64748b">0</text>

                    <line x1="40" y1="0" x2="100%" y2="0" stroke="#e2e8f0" strokeDasharray="2,2" />
                    <line x1="40" y1={chartHeight / 2} x2="100%" y2={chartHeight / 2} stroke="#e2e8f0" strokeDasharray="2,2" />
                    <line x1="40" y1={chartHeight} x2="100%" y2={chartHeight} stroke="#e2e8f0" />

                    <g transform="translate(45, 0)">
                      {boundaries.map(b => (
                        <line key={`bl-${b.index}`} x1={`${(b.index / barCount) * 95}%`} y1="0" x2={`${(b.index / barCount) * 95}%`} y2={chartHeight + 5} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,2" />
                      ))}

                      {graphData.map((d, i) => {
                        const hpp = hoursPerPersonPerMonth;
                        const pfHC = d.pf / hpp;
                        const smHC = d.sm / hpp;
                        const plHC = d.pl / hpp;
                        const totalHC = pfHC + smHC + plHC;
                        const oppHCForBar = oppMode !== 'off' ? ((oppColumnTotals.get(d.key)?.total || 0) / hpp) : 0;
                        const clickableHC = totalHC + oppHCForBar;

                        const pfH = maxValue > 0 ? (pfHC / maxValue) * chartHeight : 0;
                        const smH = maxValue > 0 ? (smHC / maxValue) * chartHeight : 0;
                        const plH = maxValue > 0 ? (plHC / maxValue) * chartHeight : 0;

                        const xPercent = (i / barCount) * 95;
                        const showLabel = i % labelEvery === 0;

                        return (
                          <g key={d.key}
                            onClick={() => clickableHC > 0 && setDrillDownCol({ key: d.key, label: d.label, monthKey: d.monthKey || d.key })}
                            style={{ cursor: clickableHC > 0 ? 'pointer' : 'default' }}
                          >
                            <rect x={`${xPercent}%`} y={chartHeight - plH} width={`${barWidth * 0.8}%`} height={plH} fill={TRADES[2].color} rx="1">
                              <title>{d.label}: PL {plHC.toFixed(1)}, SM {smHC.toFixed(1)}, PF {pfHC.toFixed(1)} = {totalHC.toFixed(1)} people</title>
                            </rect>
                            <rect x={`${xPercent}%`} y={chartHeight - plH - smH} width={`${barWidth * 0.8}%`} height={smH} fill={TRADES[1].color} rx="1">
                              <title>{d.label}: PL {plHC.toFixed(1)}, SM {smHC.toFixed(1)}, PF {pfHC.toFixed(1)} = {totalHC.toFixed(1)} people</title>
                            </rect>
                            <rect x={`${xPercent}%`} y={chartHeight - plH - smH - pfH} width={`${barWidth * 0.8}%`} height={pfH} fill={TRADES[0].color} rx="1">
                              <title>{d.label}: PL {plHC.toFixed(1)}, SM {smHC.toFixed(1)}, PF {pfHC.toFixed(1)} = {totalHC.toFixed(1)} people</title>
                            </rect>
                            {oppMode !== 'off' && (() => {
                              const ot = oppColumnTotals.get(d.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
                              const oppHC = ot.total / hoursPerPersonPerMonth;
                              const oppBarH = maxValue > 0 ? (oppHC / maxValue) * chartHeight : 0;
                              if (oppBarH <= 0.5) return null;
                              const committedH = plH + smH + pfH;
                              return (
                                <rect
                                  x={`${xPercent}%`}
                                  y={chartHeight - committedH - oppBarH}
                                  width={`${barWidth * 0.8}%`}
                                  height={oppBarH}
                                  fill="url(#opp-hatch)"
                                  stroke="#f59e0b"
                                  strokeWidth="0.5"
                                  opacity="0.85"
                                  rx="1"
                                >
                                  <title>{d.label}: +{oppHC.toFixed(1)} people from opportunities ({fmtHours(ot.total)} hrs)</title>
                                </rect>
                              );
                            })()}
                            {showLabel && (
                              <text x={`${xPercent + barWidth * 0.4}%`} y={chartHeight + 14} fontSize={isWeekly ? '8' : '9'} fill="#64748b" textAnchor="middle">
                                {d.label}
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {boundaries.map((b, idx) => {
                        const xStart = (b.index / barCount) * 95;
                        const nextB = boundaries[idx + 1];
                        const xEnd = nextB ? (nextB.index / barCount) * 95 : 95;
                        return (
                          <text key={`blbl-${b.index}`} x={`${(xStart + xEnd) / 2}%`} y={chartHeight + (isWeekly ? 30 : 32)} fontSize={isWeekly ? '9' : '11'} fontWeight="600" fill="#1e293b" textAnchor="middle">
                            {b.label}
                          </text>
                        );
                      })}
                      {!isWeekly && boundaries.length > 0 && boundaries[0].index > 0 && (
                        <text x={`${(boundaries[0].index / barCount) * 95 / 2}%`} y={chartHeight + 32} fontSize="11" fontWeight="600" fill="#1e293b" textAnchor="middle">
                          {graphData[0].key.substring(0, 4)}
                        </text>
                      )}
                    </g>
                  </svg>
                );
              })()}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.7rem', color: '#64748b', marginTop: '0.5rem' }}>
              {filteredTrades.map(t => (
                <span key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', background: t.color, borderRadius: '2px' }} />
                  {t.label}
                </span>
              ))}
              {oppMode !== 'off' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{
                    display: 'inline-block', width: '12px', height: '12px',
                    background: 'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 1px, transparent 1px, transparent 3px)',
                    border: '1px solid #f59e0b', borderRadius: '2px'
                  }} />
                  Opportunities ({oppWeighted ? 'weighted' : 'actual'})
                </span>
              )}
            </div>
          </div>

          {/* Trade breakdown bars */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
              Total Remaining Hours by Trade
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredTrades.map(trade => {
                const hrs = grandTotalsByTrade[trade.key];
                const maxHrs = Math.max(...filteredTrades.map(t => grandTotalsByTrade[t.key]), 1);
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
      {/* ─── DRILL-DOWN MODAL ─── */}
      {drillDownCol && (
        <div className="modal-overlay" onClick={() => setDrillDownCol(null)}>
          <div className="modal-container" style={{ maxWidth: '950px', width: '95%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>{drillDownCol.label} — Job Breakdown</h2>
              <button className="modal-close" onClick={() => setDrillDownCol(null)}>&times;</button>
            </div>
            <div className="modal-subtitle">
              {(() => {
                const ct = columnTotals.get(drillDownCol.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
                const ot = oppMode !== 'off' ? (oppColumnTotals.get(drillDownCol.key) || { pf: 0, sm: 0, pl: 0, total: 0 }) : { pf: 0, sm: 0, pl: 0, total: 0 };
                const hpp = hoursPerPersonPerMonth;
                return (
                  <>
                    <strong>{(ct.total / hpp).toFixed(1)}</strong> committed headcount ({fmtHours(ct.total)} hrs)
                    {' — '}
                    <span style={{ color: TRADES[0].color }}>PF {(ct.pf / hpp).toFixed(1)}</span>
                    {' / '}
                    <span style={{ color: TRADES[1].color }}>SM {(ct.sm / hpp).toFixed(1)}</span>
                    {' / '}
                    <span style={{ color: TRADES[2].color }}>PL {(ct.pl / hpp).toFixed(1)}</span>
                    <span style={{ color: '#64748b' }}> — {drillDownProjects.length} projects</span>
                    {drillDownOpps.length > 0 && (
                      <span style={{ color: '#f59e0b' }}> + {(ot.total / hpp).toFixed(1)} from {drillDownOpps.length} opportunities</span>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="modal-body" style={{ padding: '0 1rem 1rem', maxHeight: '60vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc' }}>Contract</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc' }}>Description</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc' }}>PM</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc', color: TRADES[0].color }}>PF</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc', color: TRADES[1].color }}>SM</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc', color: TRADES[2].color }}>PL</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc', fontWeight: 700 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {drillDownProjects.map(({ projection: p, hours: h }) => {
                    const hpp = hoursPerPersonPerMonth;
                    return (
                      <tr key={p.contract.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }}>
                          {p.contract.linked_project_id ? (
                            <Link to={`/projects/${p.contract.linked_project_id}`} style={{ color: '#1e40af', textDecoration: 'none', fontWeight: 500 }}>
                              {p.contract.contract_number}
                            </Link>
                          ) : (
                            <span style={{ fontWeight: 500 }}>{p.contract.contract_number}</span>
                          )}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#475569' }}>
                          {p.contract.description || p.contract.customer_name || '-'}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {p.contract.project_manager_name || '-'}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: h.pf > 0 ? TRADES[0].color : '#cbd5e1' }}>
                          {h.pf > 0 ? (h.pf / hpp).toFixed(1) : '-'}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: h.sm > 0 ? TRADES[1].color : '#cbd5e1' }}>
                          {h.sm > 0 ? (h.sm / hpp).toFixed(1) : '-'}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: h.pl > 0 ? TRADES[2].color : '#cbd5e1' }}>
                          {h.pl > 0 ? (h.pl / hpp).toFixed(1) : '-'}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                          {(h.total / hpp).toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                  {drillDownOpps.length > 0 && (
                    <>
                      <tr style={{ borderTop: '2px dashed #f59e0b', background: '#fffbeb' }}>
                        <td colSpan={7} style={{ padding: '0.4rem 0.5rem', color: '#b45309', fontWeight: 600, fontSize: '0.7rem' }}>
                          Opportunities ({oppWeighted ? 'probability-weighted' : 'actual hours'})
                        </td>
                      </tr>
                      {drillDownOpps.map(({ projection: p, hours: h }) => {
                        const hpp = hoursPerPersonPerMonth;
                        return (
                          <tr key={`opp-${p.opportunity.id}`} style={{ borderBottom: '1px solid #fde68a', background: '#fffbeb' }}>
                            <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }}>
                              <span style={{ background: '#f59e0b', color: '#fff', fontSize: '0.55rem', padding: '1px 4px', borderRadius: '3px', fontWeight: 600, marginRight: '0.25rem' }}>OPP</span>
                              <span style={{ fontWeight: 500, color: '#92400e' }}>{p.opportunity.title}</span>
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', color: '#b45309', fontSize: '0.7rem' }}>
                              {fmtCompact(parseNum(p.opportunity.estimated_value))} | {p.probability}%
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', color: '#b45309', fontSize: '0.7rem' }}>
                              {p.opportunity.assigned_to_name || '-'}
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: h.pf > 0 ? '#b45309' : '#fcd34d' }}>
                              {h.pf > 0 ? (h.pf / hpp).toFixed(1) : '-'}
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: h.sm > 0 ? '#b45309' : '#fcd34d' }}>
                              {h.sm > 0 ? (h.sm / hpp).toFixed(1) : '-'}
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: h.pl > 0 ? '#b45309' : '#fcd34d' }}>
                              {h.pl > 0 ? (h.pl / hpp).toFixed(1) : '-'}
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600, color: '#92400e' }}>
                              {(h.total / hpp).toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f1f5f9', fontWeight: 600 }}>
                    <td colSpan={3} style={{ padding: '0.5rem' }}>TOTAL ({drillDownProjects.length} projects)</td>
                    {(() => {
                      const ct = columnTotals.get(drillDownCol.key) || { pf: 0, sm: 0, pl: 0, total: 0 };
                      const hpp = hoursPerPersonPerMonth;
                      return (
                        <>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: TRADES[0].color }}>{(ct.pf / hpp).toFixed(1)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: TRADES[1].color }}>{(ct.sm / hpp).toFixed(1)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', color: TRADES[2].color }}>{(ct.pl / hpp).toFixed(1)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{(ct.total / hpp).toFixed(1)}</td>
                        </>
                      );
                    })()}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LaborForecast;
