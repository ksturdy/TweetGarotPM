import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import opportunitiesService, { Opportunity } from '../../services/opportunities';
import { getForecastRules, saveForecastRules } from '../../services/tenant';
import { format, addMonths, startOfMonth, differenceInMonths, parseISO, isBefore } from 'date-fns';
import { ContourType, contourOptions, getContourMultipliers, ContourVisual } from '../../utils/contours';
import { LOCATION_GROUPS } from '../../constants/locationGroups';
import OpportunityModal from '../../components/opportunities/OpportunityModal';

// Formatting helpers (same as ProjectedRevenue)
const fmt = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  if (isNaN(value)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const fmtCompact = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return '-';
  if (isNaN(value)) return '-';
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const parseNum = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
};

interface OpportunityProjection {
  opportunity: Opportunity;
  projectedStart: Date;
  isStaleDate: boolean;
  originalStartDate: string | null;
  workDurationMonths: number;
  monthlyRevenue: Map<string, number>;
  contour: ContourType;
  isAutoContour: boolean;
  probability: number;
  weightedValue: number;
}

interface DurationRule {
  minValue: number;
  maxValue: number;
  months: number;
  label: string;
}

// Pursuit-to-award rules: how long from today until the opportunity becomes a contract
const defaultPursuitRules: DurationRule[] = [
  { minValue: 0, maxValue: 500000, months: 2, label: '$0 - $500K' },
  { minValue: 500000, maxValue: 2000000, months: 4, label: '$500K - $2M' },
  { minValue: 2000000, maxValue: 5000000, months: 6, label: '$2M - $5M' },
  { minValue: 5000000, maxValue: 10000000, months: 9, label: '$5M - $10M' },
  { minValue: 10000000, maxValue: Infinity, months: 12, label: '$10M+' },
];

// Work duration rules: how long the mechanical work will take once awarded
const defaultWorkDurationRules: DurationRule[] = [
  { minValue: 0, maxValue: 500000, months: 3, label: '$0 - $500K' },
  { minValue: 500000, maxValue: 2000000, months: 6, label: '$500K - $2M' },
  { minValue: 2000000, maxValue: 5000000, months: 8, label: '$2M - $5M' },
  { minValue: 5000000, maxValue: 10000000, months: 12, label: '$5M - $10M' },
  { minValue: 10000000, maxValue: Infinity, months: 24, label: '$10M+' },
];

const OpportunityProjectedRevenue: React.FC = () => {
  // Filters
  const [marketFilter, setMarketFilter] = useState<string>('');
  const [assignedFilter, setAssignedFilter] = useState<string>('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [locationGroupFilter, setLocationGroupFilter] = useState<string>('');

  // User-adjusted overrides per opportunity
  const [adjustedStartDates, setAdjustedStartDates] = useState<Record<number, string>>({});
  const [adjustedDurationMonths, setAdjustedDurationMonths] = useState<Record<number, number>>({});
  const [selectedContours, setSelectedContours] = useState<Record<number, ContourType>>({});

  // Track whether we've initialized overrides from DB data
  const [overridesInitialized, setOverridesInitialized] = useState(false);

  // Settings — loaded from tenant API
  const [pursuitRules, setPursuitRules] = useState<DurationRule[]>(defaultPursuitRules);
  const [workDurationRules, setWorkDurationRules] = useState<DurationRule[]>(defaultWorkDurationRules);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'pursuit' | 'duration'>('pursuit');
  const [savingRules, setSavingRules] = useState(false);
  const queryClient = useQueryClient();

  // Load saved forecast rules from tenant settings
  const { data: savedForecastRules } = useQuery({
    queryKey: ['forecastRules'],
    queryFn: getForecastRules,
  });

  // Apply saved rules once loaded
  useEffect(() => {
    if (savedForecastRules) {
      if (savedForecastRules.pursuitRules?.length) setPursuitRules(savedForecastRules.pursuitRules);
      if (savedForecastRules.workDurationRules?.length) setWorkDurationRules(savedForecastRules.workDurationRules);
    }
  }, [savedForecastRules]);

  const saveRules = useCallback(async () => {
    setSavingRules(true);
    try {
      await saveForecastRules({ pursuitRules, workDurationRules });
      queryClient.invalidateQueries({ queryKey: ['forecastRules'] });
      setShowSettings(false);
    } catch (err) {
      console.error('Failed to save forecast rules:', err);
    } finally {
      setSavingRules(false);
    }
  }, [pursuitRules, workDurationRules, queryClient]);

  // Sorting
  const [sortColumn, setSortColumn] = useState<'name' | 'value' | 'probability' | 'start'>('value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Opportunity modal
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'name' ? 'asc' : 'desc');
    }
  };

  const SortIndicator: React.FC<{ column: typeof sortColumn }> = ({ column }) => {
    if (sortColumn !== column) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>&#8645;</span>;
    return <span style={{ marginLeft: '4px' }}>{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>;
  };

  // Duration lookup helper
  const getDurationForValue = (value: number, rules: DurationRule[]): number => {
    for (const rule of rules) {
      if (value >= rule.minValue && value < rule.maxValue) {
        return rule.months;
      }
    }
    return 24;
  };

  // Fetch opportunities
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ['opportunities', 'projectedRevenue'],
    queryFn: () => opportunitiesService.getAll(),
  });

  // Fetch pipeline stages for filter
  const { data: stages = [] } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: () => opportunitiesService.getStages(),
  });

  // Initialize overrides from DB
  useEffect(() => {
    if (opportunities && !overridesInitialized) {
      const startDates: Record<number, string> = {};
      const durations: Record<number, number> = {};
      const contours: Record<number, ContourType> = {};

      opportunities.forEach(o => {
        if (o.user_adjusted_start_date) {
          startDates[o.id] = o.user_adjusted_start_date;
        }
        if (o.user_adjusted_duration_months != null) {
          durations[o.id] = o.user_adjusted_duration_months;
        }
        if (o.contour_type) {
          contours[o.id] = o.contour_type as ContourType;
        }
      });

      setAdjustedStartDates(startDates);
      setAdjustedDurationMonths(durations);
      setSelectedContours(contours);
      setOverridesInitialized(true);
    }
  }, [opportunities, overridesInitialized]);

  // Save projection override to backend
  const saveProjectionOverride = useCallback(async (
    opportunityId: number,
    overrides: {
      contour_type?: string | null;
      user_adjusted_start_date?: string | null;
      user_adjusted_duration_months?: number | null;
    }
  ) => {
    try {
      await opportunitiesService.updateProjectionOverrides(opportunityId, overrides);
    } catch (err) {
      console.error('Failed to save projection override:', err);
    }
  }, []);

  // Update location group
  const updateLocationGroup = useCallback(async (opportunityId: number, locationGroup: string) => {
    try {
      await opportunitiesService.update(opportunityId, { location_group: locationGroup });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    } catch (err) {
      console.error('Failed to update location group:', err);
    }
  }, [queryClient]);

  // Modal handlers
  const handleOpenModal = useCallback((opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity);
    setIsModalOpen(true);
  }, []);

  const handleSaveModal = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['opportunities'] });
  }, [queryClient]);

  const handleCloseModal = useCallback(() => {
    setSelectedOpportunity(null);
    setIsModalOpen(false);
  }, []);

  // Filter options
  const filterOptions = useMemo(() => {
    if (!opportunities) return { markets: [], assignees: [] };

    const markets = new Set<string>();
    const assignees = new Set<string>();

    opportunities.forEach(o => {
      if (o.market) markets.add(o.market);
      if (o.assigned_to_name) assignees.add(o.assigned_to_name);
    });

    return {
      markets: Array.from(markets).sort(),
      assignees: Array.from(assignees).sort(),
    };
  }, [opportunities]);

  // Excluded stages (Won, Lost, Passed)
  const excludedStageNames = useMemo(() => {
    return new Set(['Won', 'Lost', 'Passed']);
  }, []);

  // Generate column headers (next 12 months + years)
  const columns = useMemo(() => {
    const cols: { key: string; label: string; isYear: boolean }[] = [];
    const now = startOfMonth(new Date());
    const twelveMonthsOut = addMonths(now, 11);

    for (let i = 0; i < 12; i++) {
      const date = addMonths(now, i);
      cols.push({
        key: format(date, 'yyyy-MM'),
        label: format(date, 'MMM yy'),
        isYear: false,
      });
    }

    const currentYear = now.getFullYear();
    const maxYear = currentYear + 3;
    for (let year = currentYear; year <= maxYear; year++) {
      const lastMonthOfYear = new Date(year, 11, 1);
      if (lastMonthOfYear > twelveMonthsOut) {
        cols.push({
          key: String(year),
          label: String(year),
          isYear: true,
        });
      }
    }

    return cols;
  }, []);

  // Calculate projections
  const projections = useMemo(() => {
    if (!opportunities) return [];

    const now = startOfMonth(new Date());
    const twelveMonthsOut = addMonths(now, 11);
    const results: OpportunityProjection[] = [];

    // Filter opportunities
    const filtered = opportunities.filter(o => {
      // Exclude Won, Lost, Passed stages
      if (o.stage_name && excludedStageNames.has(o.stage_name)) return false;

      // Exclude Awarded opportunities already in Vista (In Progress or Completed)
      if (o.stage_name === 'Awarded' && ['In Progress', 'Completed'].includes(o.awarded_status || '')) return false;

      // Must have an estimated value
      if (!o.estimated_value || parseNum(o.estimated_value) <= 0) return false;

      // Stage filter
      if (stageFilter && String(o.stage_id) !== stageFilter) return false;

      // Market filter
      if (marketFilter && o.market !== marketFilter) return false;

      // Location group filter
      if (locationGroupFilter && o.location_group !== locationGroupFilter) return false;

      // Assigned filter
      if (assignedFilter && o.assigned_to_name !== assignedFilter) return false;

      // Search filter
      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        const matchesTitle = o.title?.toLowerCase().includes(search);
        const matchesOwner = o.owner?.toLowerCase().includes(search);
        const matchesGC = o.general_contractor?.toLowerCase().includes(search);
        if (!matchesTitle && !matchesOwner && !matchesGC) return false;
      }

      return true;
    });

    for (const opp of filtered) {
      const estimatedValue = parseNum(opp.estimated_value);

      // Determine probability: user qualitative override mapped to numeric, else stage probability
      const qualitativeProbMap: Record<string, number> = { 'High': 75, 'Medium': 50, 'Low': 25 };
      const probability = opp.probability && qualitativeProbMap[opp.probability]
        ? qualitativeProbMap[opp.probability]
        : parseNum(opp.stage_probability);

      const weightedValue = estimatedValue * (probability / 100);

      // --- Determine projected start date ---
      let projectedStart: Date;
      let isStaleDate = false;
      const originalStartDate = opp.estimated_start_date || null;

      if (adjustedStartDates[opp.id]) {
        // User manually overrode the start date
        projectedStart = startOfMonth(parseISO(adjustedStartDates[opp.id]));
      } else if (opp.estimated_start_date && !isBefore(parseISO(opp.estimated_start_date), now)) {
        // Future date — use as-is
        projectedStart = startOfMonth(parseISO(opp.estimated_start_date));
      } else if (opp.estimated_start_date && isBefore(parseISO(opp.estimated_start_date), now)) {
        // STALE date — auto-adjust using pursuit rules
        isStaleDate = true;
        const pursuitMonths = getDurationForValue(estimatedValue, pursuitRules);
        projectedStart = addMonths(now, pursuitMonths);
      } else {
        // No date at all — use pursuit rules
        const pursuitMonths = getDurationForValue(estimatedValue, pursuitRules);
        projectedStart = addMonths(now, pursuitMonths);
      }

      // --- Determine work duration ---
      let workDurationMonths: number;

      if (adjustedDurationMonths[opp.id] !== undefined) {
        workDurationMonths = adjustedDurationMonths[opp.id];
      } else if (opp.estimated_end_date && opp.estimated_start_date) {
        const diff = differenceInMonths(parseISO(opp.estimated_end_date), projectedStart);
        workDurationMonths = Math.max(1, diff);
      } else if (opp.estimated_duration_days) {
        workDurationMonths = Math.max(1, Math.round(parseNum(opp.estimated_duration_days) / 30));
      } else {
        workDurationMonths = getDurationForValue(estimatedValue, workDurationRules);
      }

      workDurationMonths = Math.max(1, Math.min(36, workDurationMonths));

      // --- Get contour ---
      const userSelectedContour = selectedContours[opp.id];
      const contour: ContourType = userSelectedContour || 'scurve'; // Opportunities are 0% complete → s-curve
      const isAutoContour = !userSelectedContour;

      // --- Distribute weighted value across months ---
      const monthlyRevenue = new Map<string, number>();

      if (weightedValue > 0 && workDurationMonths > 0) {
        const multipliers = getContourMultipliers(workDurationMonths, contour);
        const baseMonthly = weightedValue / workDurationMonths;

        // Calculate how many months from now until work starts
        const monthsUntilStart = Math.max(0, differenceInMonths(projectedStart, now));

        for (let i = 0; i < workDurationMonths; i++) {
          const monthDate = addMonths(now, monthsUntilStart + i);
          const monthKey = format(monthDate, 'yyyy-MM');
          const yearKey = String(monthDate.getFullYear());

          const monthRevenue = baseMonthly * multipliers[i];

          monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + monthRevenue);

          // Only add to year bucket for months after the 12-month individual view
          if (monthDate > twelveMonthsOut) {
            monthlyRevenue.set(yearKey, (monthlyRevenue.get(yearKey) || 0) + monthRevenue);
          }
        }
      }

      results.push({
        opportunity: opp,
        projectedStart,
        isStaleDate,
        originalStartDate,
        workDurationMonths,
        monthlyRevenue,
        contour,
        isAutoContour,
        probability,
        weightedValue,
      });
    }

    // Sort
    results.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'name':
          comparison = (a.opportunity.title || '').localeCompare(b.opportunity.title || '');
          break;
        case 'value':
          comparison = parseNum(a.opportunity.estimated_value) - parseNum(b.opportunity.estimated_value);
          break;
        case 'probability':
          comparison = a.probability - b.probability;
          break;
        case 'start':
          comparison = a.projectedStart.getTime() - b.projectedStart.getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return results;
  }, [opportunities, marketFilter, assignedFilter, stageFilter, searchFilter, locationGroupFilter, adjustedStartDates, adjustedDurationMonths, selectedContours, pursuitRules, workDurationRules, sortColumn, sortDirection, excludedStageNames]);

  // Column totals
  const columnTotals = useMemo(() => {
    const totals = new Map<string, number>();
    columns.forEach(col => {
      let total = 0;
      projections.forEach(p => {
        total += p.monthlyRevenue.get(col.key) || 0;
      });
      totals.set(col.key, total);
    });
    return totals;
  }, [projections, columns]);

  // Grand totals
  const grandTotalWeighted = useMemo(() => {
    return projections.reduce((sum, p) => sum + p.weightedValue, 0);
  }, [projections]);

  const grandTotalUnweighted = useMemo(() => {
    return projections.reduce((sum, p) => sum + parseNum(p.opportunity.estimated_value), 0);
  }, [projections]);

  const staleCount = useMemo(() => {
    return projections.filter(p => p.isStaleDate).length;
  }, [projections]);

  if (isLoading) {
    return <div className="loading">Loading opportunities...</div>;
  }

  // Helper to render the duration rules editor
  const renderRulesEditor = (
    rules: DurationRule[],
    setRules: React.Dispatch<React.SetStateAction<DurationRule[]>>,
    defaults: DurationRule[],
    title: string,
    description: string
  ) => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400e', margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={saveRules}
            disabled={savingRules}
            style={{
              padding: '0.25rem 0.75rem', fontSize: '0.7rem',
              background: savingRules ? '#86efac' : '#16a34a', border: '1px solid #15803d',
              borderRadius: '4px', cursor: savingRules ? 'default' : 'pointer', color: '#fff', fontWeight: 500
            }}
          >
            {savingRules ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setRules(defaults)}
            style={{
              padding: '0.25rem 0.5rem', fontSize: '0.7rem',
              background: '#fef3c7', border: '1px solid #fcd34d',
              borderRadius: '4px', cursor: 'pointer', color: '#92400e'
            }}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
      <p style={{ fontSize: '0.7rem', color: '#78716c', margin: '0 0 0.75rem 0' }}>{description}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {rules.map((rule, index) => (
          <div key={index} style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px',
            padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#1e293b' }}>{rule.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Duration:</label>
              <input
                type="number" min="1" max="36" value={rule.months}
                onChange={(e) => {
                  const newMonths = parseInt(e.target.value) || 1;
                  setRules(r => r.map((item, i) =>
                    i === index ? { ...item, months: Math.max(1, Math.min(36, newMonths)) } : item
                  ));
                }}
                style={{
                  width: '50px', padding: '0.25rem 0.35rem', fontSize: '0.75rem',
                  border: '1px solid #e2e8f0', borderRadius: '4px', textAlign: 'center'
                }}
              />
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>months</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <Link to="/sales" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.8rem' }}>&larr; Opportunities</Link>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem' }}>Opportunity Revenue Forecast</h2>
          <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
            {projections.length} opportunities | Pipeline: {fmt(grandTotalUnweighted)} | Weighted: {fmt(grandTotalWeighted)}
            {staleCount > 0 && (
              <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>
                | {staleCount} stale date{staleCount !== 1 ? 's' : ''} auto-adjusted
              </span>
            )}
          </div>
        </div>
        <Link
          to="/reports/backlog-fit"
          style={{
            padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#3b82f6',
            color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer',
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Backlog Fit Analysis
        </Link>
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
              placeholder="Title, owner, GC..."
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '150px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Stage</label>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            >
              <option value="">All Active Stages</option>
              {stages
                .filter(s => !excludedStageNames.has(s.name))
                .map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.probability}%)</option>
                ))
              }
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Market</label>
            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            >
              <option value="">All Markets</option>
              {filterOptions.markets.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Location Group</label>
            <select
              value={locationGroupFilter}
              onChange={(e) => setLocationGroupFilter(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            >
              <option value="">All Groups</option>
              {LOCATION_GROUPS.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Assigned To</label>
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            >
              <option value="">All</option>
              {filterOptions.assignees.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {(searchFilter || stageFilter || marketFilter || locationGroupFilter || assignedFilter) && (
            <button
              onClick={() => { setSearchFilter(''); setStageFilter(''); setMarketFilter(''); setLocationGroupFilter(''); setAssignedFilter(''); }}
              style={{
                padding: '0.35rem 0.75rem', fontSize: '0.75rem', background: '#f1f5f9',
                border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem'
              }}
            >
              Clear Filters
            </button>
          )}

          {/* Settings button */}
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
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
              Rules
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: '#fffbeb', border: '1px solid #fcd34d' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              onClick={() => setSettingsTab('pursuit')}
              style={{
                padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                background: settingsTab === 'pursuit' ? '#f59e0b' : '#fef3c7',
                color: settingsTab === 'pursuit' ? '#fff' : '#92400e',
                border: '1px solid #fcd34d', borderRadius: '4px', cursor: 'pointer'
              }}
            >
              Pursuit-to-Award Rules
            </button>
            <button
              onClick={() => setSettingsTab('duration')}
              style={{
                padding: '0.35rem 0.75rem', fontSize: '0.75rem',
                background: settingsTab === 'duration' ? '#f59e0b' : '#fef3c7',
                color: settingsTab === 'duration' ? '#fff' : '#92400e',
                border: '1px solid #fcd34d', borderRadius: '4px', cursor: 'pointer'
              }}
            >
              Work Duration Rules
            </button>
          </div>

          {settingsTab === 'pursuit' && renderRulesEditor(
            pursuitRules, setPursuitRules, defaultPursuitRules,
            'Pursuit-to-Award Duration by Estimated Value',
            'When an opportunity has a stale start date (in the past) or no start date, these rules estimate how many months from today until award. Only applies to stale/missing dates \u2014 future-dated opportunities use their entered start date.'
          )}

          {settingsTab === 'duration' && renderRulesEditor(
            workDurationRules, setWorkDurationRules, defaultWorkDurationRules,
            'Work Duration by Estimated Value',
            'How long the mechanical work will take once awarded. Used when no duration or end date is entered on the opportunity.'
          )}
        </div>
      )}

      {/* Revenue Grid Table */}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th
                onClick={() => handleSort('name')}
                style={{
                  padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0',
                  position: 'sticky', left: 0, background: '#f8fafc', minWidth: '200px',
                  cursor: 'pointer', userSelect: 'none'
                }}
              >
                Opportunity<SortIndicator column="name" />
              </th>
              <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '70px' }}>
                Location
              </th>
              <th
                onClick={() => handleSort('value')}
                style={{
                  padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0',
                  minWidth: '70px', cursor: 'pointer', userSelect: 'none'
                }}
              >
                Value<SortIndicator column="value" />
              </th>
              <th
                onClick={() => handleSort('probability')}
                style={{
                  padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0',
                  minWidth: '50px', cursor: 'pointer', userSelect: 'none'
                }}
              >
                Prob<SortIndicator column="probability" />
              </th>
              <th
                onClick={() => handleSort('start')}
                style={{
                  padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0',
                  minWidth: '80px', cursor: 'pointer', userSelect: 'none'
                }}
              >
                Start<SortIndicator column="start" />
              </th>
              <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '60px' }}>Duration</th>
              <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '80px' }}>Contour</th>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{
                    padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0',
                    minWidth: col.isYear ? '70px' : '60px',
                    background: col.isYear ? '#f1f5f9' : '#f8fafc'
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projections.map((p) => (
              <tr key={p.opportunity.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                {/* Opportunity name */}
                <td style={{ padding: '0.4rem 0.5rem', position: 'sticky', left: 0, background: '#fff' }}>
                  <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {p.isStaleDate && (
                      <span
                        title={`Original date: ${p.originalStartDate ? format(parseISO(p.originalStartDate), 'MMM d, yyyy') : 'none'} (stale - auto-adjusted)`}
                        style={{ color: '#f59e0b', fontSize: '0.7rem', cursor: 'help' }}
                      >
                        &#9888;
                      </span>
                    )}
                    <span
                      onClick={() => handleOpenModal(p.opportunity)}
                      style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}
                      title="Click to view opportunity details"
                    >
                      {p.opportunity.title}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                    {p.opportunity.owner || p.opportunity.general_contractor || p.opportunity.market}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                    {p.opportunity.stage_name} | {p.opportunity.assigned_to_name || 'Unassigned'}
                  </div>
                </td>

                {/* Location Group */}
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                  <select
                    value={p.opportunity.location_group || ''}
                    onChange={(e) => updateLocationGroup(p.opportunity.id, e.target.value)}
                    style={{
                      padding: '0.15rem 0.25rem', fontSize: '0.65rem',
                      border: p.opportunity.location_group ? '1px solid #e2e8f0' : '1px solid #ef4444',
                      borderRadius: '3px',
                      background: p.opportunity.location_group ? 'transparent' : '#fef2f2',
                      color: p.opportunity.location_group ? '#64748b' : '#ef4444',
                      cursor: 'pointer', width: '70px'
                    }}
                    title={p.opportunity.location_group ? 'Location group' : 'No location group assigned'}
                  >
                    <option value="">None</option>
                    {LOCATION_GROUPS.map(g => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </td>

                {/* Value */}
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>
                  {fmtCompact(parseNum(p.opportunity.estimated_value))}
                </td>

                {/* Probability */}
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#64748b' }}>
                  {p.probability > 0 ? `${p.probability}%` : '-'}
                </td>

                {/* Projected Start */}
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.65rem' }}>
                  <input
                    type="month"
                    value={format(p.projectedStart, 'yyyy-MM')}
                    onChange={(e) => {
                      const newDate = e.target.value + '-01';
                      setAdjustedStartDates(prev => ({ ...prev, [p.opportunity.id]: newDate }));
                      saveProjectionOverride(p.opportunity.id, { user_adjusted_start_date: newDate });
                    }}
                    style={{
                      padding: '0.15rem 0.25rem', fontSize: '0.65rem',
                      border: adjustedStartDates[p.opportunity.id]
                        ? '1px solid #16a34a'
                        : p.isStaleDate ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                      borderRadius: '3px',
                      background: adjustedStartDates[p.opportunity.id]
                        ? '#dcfce7'
                        : p.isStaleDate ? '#fef3c7' : 'transparent',
                      color: adjustedStartDates[p.opportunity.id]
                        ? '#15803d'
                        : p.isStaleDate ? '#92400e' : '#64748b',
                      cursor: 'pointer', width: '95px'
                    }}
                    title={
                      p.isStaleDate
                        ? `Original: ${p.originalStartDate ? format(parseISO(p.originalStartDate), 'MMM yyyy') : 'none'} (stale). Click to override.`
                        : adjustedStartDates[p.opportunity.id]
                        ? 'User-adjusted start date'
                        : 'Estimated start date. Click to override.'
                    }
                  />
                </td>

                {/* Duration */}
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.65rem' }}>
                  <select
                    value={p.workDurationMonths}
                    onChange={(e) => {
                      const newMonths = parseInt(e.target.value);
                      setAdjustedDurationMonths(prev => ({ ...prev, [p.opportunity.id]: newMonths }));
                      saveProjectionOverride(p.opportunity.id, { user_adjusted_duration_months: newMonths });
                    }}
                    style={{
                      padding: '0.15rem 0.25rem', fontSize: '0.65rem',
                      border: adjustedDurationMonths[p.opportunity.id] !== undefined ? '1px solid #16a34a' : '1px solid #e2e8f0',
                      borderRadius: '3px',
                      background: adjustedDurationMonths[p.opportunity.id] !== undefined ? '#dcfce7' : 'transparent',
                      color: adjustedDurationMonths[p.opportunity.id] !== undefined ? '#15803d' : '#64748b',
                      cursor: 'pointer', width: '65px'
                    }}
                    title="Work duration in months"
                  >
                    {Array.from({ length: 36 }, (_, i) => i + 1).map(months => (
                      <option key={months} value={months}>{months} mo</option>
                    ))}
                  </select>
                </td>

                {/* Contour */}
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                    <ContourVisual contour={p.contour} />
                    <select
                      value={p.contour}
                      onChange={(e) => {
                        const newContour = e.target.value as ContourType;
                        setSelectedContours(prev => ({ ...prev, [p.opportunity.id]: newContour }));
                        saveProjectionOverride(p.opportunity.id, { contour_type: newContour });
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
                      title={p.isAutoContour ? 'Auto-selected (S-Curve). Click to override.' : 'User-selected contour.'}
                    >
                      {contourOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </td>

                {/* Monthly revenue cells */}
                {columns.map(col => {
                  const value = p.monthlyRevenue.get(col.key) || 0;
                  return (
                    <td
                      key={col.key}
                      style={{
                        padding: '0.4rem 0.5rem', textAlign: 'right',
                        color: value > 0 ? '#1e293b' : '#cbd5e1',
                        background: col.isYear ? '#fafafa' : 'transparent'
                      }}
                    >
                      {value > 0 ? fmtCompact(value) : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f1f5f9', fontWeight: 600 }}>
              <td style={{ padding: '0.5rem', position: 'sticky', left: 0, background: '#f1f5f9' }}>
                TOTAL ({projections.length} opportunities)
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>-</td>
              <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                {fmtCompact(grandTotalUnweighted)}
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.65rem', color: '#64748b' }}>
                wtd: {fmtCompact(grandTotalWeighted)}
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>-</td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>-</td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>-</td>
              {columns.map(col => (
                <td
                  key={col.key}
                  style={{
                    padding: '0.5rem', textAlign: 'right',
                    background: col.isYear ? '#e8ecf0' : '#f1f5f9'
                  }}
                >
                  {fmtCompact(columnTotals.get(col.key) || 0)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend */}
      <div style={{ marginTop: '1rem', fontSize: '0.7rem', color: '#64748b' }}>
        <strong>How opportunity projections work:</strong> Estimated value is weighted by probability (stage-based or user override),
        then distributed from the projected start date over the work duration using the selected work contour.
        <br />
        <strong>Stale dates:</strong> <span style={{ color: '#f59e0b' }}>&#9888;</span> indicates the original start date is in the past.
        The system auto-adjusts using Pursuit-to-Award rules based on opportunity value (click Rules to edit).
        Manually override any start date by clicking it.
        <br />
        <strong>Styling:</strong> <span style={{ border: '1px solid #16a34a', padding: '0 2px', borderRadius: '2px', background: '#dcfce7', color: '#15803d' }}>green</span> = user-adjusted |
        <span style={{ fontStyle: 'italic', border: '1px dashed #94a3b8', padding: '0 2px', borderRadius: '2px', marginLeft: '0.25rem' }}>dashed</span> = auto-selected |
        <span style={{ border: '1px solid #f59e0b', padding: '0 2px', borderRadius: '2px', background: '#fef3c7', color: '#92400e', marginLeft: '0.25rem' }}>amber</span> = stale date auto-adjusted
      </div>

      {/* Opportunity Modal */}
      {isModalOpen && selectedOpportunity && (
        <OpportunityModal
          opportunity={selectedOpportunity}
          onClose={handleCloseModal}
          onSave={handleSaveModal}
        />
      )}
    </div>
  );
};

export default OpportunityProjectedRevenue;
