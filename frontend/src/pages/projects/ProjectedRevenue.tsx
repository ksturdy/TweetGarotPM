import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vistaDataService, VPContract } from '../../services/vistaData';
import { format, differenceInMonths, addMonths, startOfMonth } from 'date-fns';

// Formatting helpers
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

// Work Contour types - define how work is distributed over time
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

// Generate contour multipliers for distributing work over N months
const getContourMultipliers = (months: number, contour: ContourType): number[] => {
  const multipliers: number[] = [];

  for (let i = 0; i < months; i++) {
    const position = months > 1 ? i / (months - 1) : 0.5; // 0 to 1
    let weight: number;

    switch (contour) {
      case 'front':
        // Front loaded: starts high, decreases linearly
        weight = 2 - position * 1.5;
        break;
      case 'back':
        // Back loaded: starts low, increases linearly
        weight = 0.5 + position * 1.5;
        break;
      case 'bell':
        // Bell curve: peak in middle
        weight = Math.exp(-Math.pow((position - 0.5) * 3, 2)) * 1.5 + 0.5;
        break;
      case 'turtle':
        // Turtle: slow start, steady middle, slow end (flatter bell)
        weight = Math.exp(-Math.pow((position - 0.5) * 2, 2)) * 0.8 + 0.6;
        break;
      case 'double':
        // Double peak: two peaks at 25% and 75% (mobilization and closeout)
        const peak1 = Math.exp(-Math.pow((position - 0.25) * 5, 2));
        const peak2 = Math.exp(-Math.pow((position - 0.75) * 5, 2));
        weight = (peak1 + peak2) * 0.8 + 0.4;
        break;
      case 'early':
        // Early peak: sharp peak at ~20%, then gradual decline
        weight = Math.exp(-Math.pow((position - 0.2) * 4, 2)) * 1.8 + 0.2;
        break;
      case 'late':
        // Late peak: gradual build to sharp peak at ~80%
        weight = Math.exp(-Math.pow((position - 0.8) * 4, 2)) * 1.8 + 0.2;
        break;
      case 'scurve':
        // S-Curve: slow start, rapid middle, slow finish (cumulative looks like S)
        // This is the derivative of an S-curve (bell-ish but with longer tails)
        weight = Math.exp(-Math.pow((position - 0.5) * 2.5, 2)) * 1.2 + 0.4;
        break;
      case 'rampup':
        // Ramp up: starts near zero, linearly increases
        weight = 0.1 + position * 1.9;
        break;
      case 'rampdown':
        // Ramp down: starts high, linearly decreases to near zero
        weight = 2 - position * 1.9;
        break;
      case 'flat':
      default:
        weight = 1;
        break;
    }
    multipliers.push(weight);
  }

  // Normalize so weights sum to months (so total equals backlog)
  const sum = multipliers.reduce((a, b) => a + b, 0);
  return multipliers.map(w => (w / sum) * months);
};

// Get default contour based on % complete
// Projects at different stages typically have different work distribution patterns
const getDefaultContour = (pctComplete: number): ContourType => {
  if (pctComplete < 15) {
    // Early stage: typical S-curve for construction - slow start, ramp up
    return 'scurve';
  } else if (pctComplete < 40) {
    // Ramping up: peak activity coming in middle of remaining work
    return 'bell';
  } else if (pctComplete < 70) {
    // Mid-project: remaining work will taper off
    return 'back';
  } else if (pctComplete < 90) {
    // Winding down: gradual decrease
    return 'rampdown';
  } else {
    // Closeout: minimal remaining work, flat distribution
    return 'flat';
  }
};

// Mini SVG visualization of contour shape
const ContourVisual: React.FC<{ contour: ContourType }> = ({ contour }) => {
  const points: string = (() => {
    switch (contour) {
      case 'flat':
        return '0,8 24,8';
      case 'front':
        return '0,2 24,14';
      case 'back':
        return '0,14 24,2';
      case 'bell':
        return '0,14 6,10 12,2 18,10 24,14';
      case 'turtle':
        return '0,12 4,10 8,6 12,5 16,6 20,10 24,12';
      case 'double':
        return '0,12 4,6 8,10 12,14 16,10 20,6 24,12';
      case 'early':
        return '0,10 4,2 8,6 12,10 18,12 24,14';
      case 'late':
        return '0,14 6,12 12,10 16,6 20,2 24,10';
      case 'scurve':
        return '0,13 4,12 8,8 12,4 16,4 20,8 24,13';
      case 'rampup':
        return '0,14 24,2';
      case 'rampdown':
        return '0,2 24,14';
      default:
        return '0,8 24,8';
    }
  })();

  return (
    <svg width="24" height="16" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
      <polyline
        points={points}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

interface ProjectProjection {
  contract: VPContract;
  monthlyBurnRate: number;
  remainingMonths: number;
  projectedEndDate: Date | null;
  monthlyRevenue: Map<string, number>; // key: 'YYYY-MM' or 'YYYY'
  contour: ContourType;
  isAutoContour: boolean;
  pctComplete: number;
}

// Duration rules based on contract value
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

const ProjectedRevenue: React.FC = () => {
  // Filters
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [marketFilter, setMarketFilter] = useState<string>('');
  const [pmFilter, setPmFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 'all', 'Open', 'Soft-Closed'
  const [searchFilter, setSearchFilter] = useState<string>('');

  // User-adjusted end months per contract (contractId -> number of months from now)
  const [adjustedEndMonths, setAdjustedEndMonths] = useState<Record<number, number>>({});

  // User-selected work contours per contract (contractId -> ContourType)
  const [selectedContours, setSelectedContours] = useState<Record<number, ContourType>>({});

  // View mode: 'table' or 'graph'
  const [viewMode, setViewMode] = useState<'table' | 'graph'>('table');

  // Duration rules configuration
  const [durationRules, setDurationRules] = useState<DurationRule[]>(defaultDurationRules);
  const [showSettings, setShowSettings] = useState(false);

  // Get duration based on contract value using rules
  const getDurationForValue = (contractValue: number): number => {
    for (const rule of durationRules) {
      if (contractValue >= rule.minValue && contractValue < rule.maxValue) {
        return rule.months;
      }
    }
    return 24; // Default to 24 months if no rule matches
  };

  // Fetch all contracts (Open and Soft-Closed)
  const { data: contracts, isLoading } = useQuery({
    queryKey: ['vpContracts', 'projectedRevenue'],
    queryFn: () => vistaDataService.getAllContracts({ status: '' }), // Get all, filter client-side
  });

  // Get unique filter values
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

  // Generate column headers (next 12 months + years until 2030)
  const columns = useMemo(() => {
    const cols: { key: string; label: string; isYear: boolean }[] = [];
    const now = startOfMonth(new Date());
    const twelveMonthsOut = addMonths(now, 11); // Last month shown individually

    // Next 12 months
    for (let i = 0; i < 12; i++) {
      const date = addMonths(now, i);
      cols.push({
        key: format(date, 'yyyy-MM'),
        label: format(date, 'MMM yy'),
        isYear: false,
      });
    }

    // Years after the 12-month view, cap at 3 years out (36 months total)
    // Include a year if ANY of its months are AFTER the 12-month individual view
    const currentYear = now.getFullYear();
    const maxYear = currentYear + 3; // 3 years max
    for (let year = currentYear; year <= maxYear; year++) {
      // Check if the last month of this year (Dec) is after the 12-month view
      const lastMonthOfYear = new Date(year, 11, 1); // Dec 1 of the year
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

  // Calculate projections for filtered contracts
  const projections = useMemo(() => {
    if (!contracts) return [];

    const now = startOfMonth(new Date());
    const results: ProjectProjection[] = [];

    // Filter contracts
    const filtered = contracts.filter(c => {
      // Status filter
      const status = c.status?.toLowerCase() || '';
      if (statusFilter === 'all') {
        if (!status.includes('open') && !status.includes('soft')) return false;
      } else if (statusFilter === 'Open') {
        if (!status.includes('open')) return false;
      } else if (statusFilter === 'Soft-Closed') {
        if (!status.includes('soft')) return false;
      }

      // Department filter
      if (departmentFilter && c.department_code !== departmentFilter) return false;

      // Market filter
      if (marketFilter && c.primary_market !== marketFilter) return false;

      // PM filter
      if (pmFilter && c.project_manager_name !== pmFilter) return false;

      // Search filter
      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        const matchesNumber = c.contract_number?.toLowerCase().includes(search);
        const matchesDesc = c.description?.toLowerCase().includes(search);
        const matchesCustomer = c.customer_name?.toLowerCase().includes(search);
        if (!matchesNumber && !matchesDesc && !matchesCustomer) return false;
      }

      return true;
    });

    for (const contract of filtered) {
      const earnedRevenue = parseNum(contract.earned_revenue);
      const projectedRevenue = parseNum(contract.projected_revenue);
      const backlog = parseNum(contract.backlog);
      const contractValue = parseNum(contract.contract_amount) || projectedRevenue;

      // Check if user has adjusted the end date for this contract
      const userAdjustedMonths = adjustedEndMonths[contract.id];

      // Calculate remaining months based on contract value rules (or user override)
      let remainingMonths = 0;
      let monthlyBurnRate = 0;
      let projectedEndDate: Date | null = null;

      if (backlog > 0) {
        if (userAdjustedMonths !== undefined) {
          // User has manually set the end date - spread backlog over their specified months
          remainingMonths = Math.max(1, Math.min(36, userAdjustedMonths));
        } else {
          // Use contract value-based duration rules to project end date
          const totalDuration = getDurationForValue(contractValue);

          // Calculate % complete and estimate remaining months
          const pctComplete = projectedRevenue > 0 ? earnedRevenue / projectedRevenue : 0;
          const monthsRemaining = Math.ceil(totalDuration * (1 - pctComplete));

          // Ensure at least 1 month remaining if there's backlog, cap at 36
          remainingMonths = Math.max(1, Math.min(36, monthsRemaining));
        }

        monthlyBurnRate = backlog / remainingMonths;
        projectedEndDate = addMonths(now, remainingMonths);
      }

      // Generate monthly revenue projections
      const monthlyRevenue = new Map<string, number>();
      const twelveMonthsOut = addMonths(now, 11); // Last month shown individually

      // Calculate % complete for auto-contour selection
      const pctComplete = projectedRevenue > 0 ? (earnedRevenue / projectedRevenue) * 100 : 0;

      // Get contour: use user selection if set, otherwise auto-select based on % complete
      const userSelectedContour = selectedContours[contract.id];
      const autoContour = getDefaultContour(pctComplete);
      const contour = userSelectedContour || autoContour;
      const isAutoContour = !userSelectedContour;

      if (backlog > 0 && remainingMonths > 0) {
        // Get contour multipliers for distributing revenue
        const multipliers = getContourMultipliers(remainingMonths, contour);
        // Base monthly amount if evenly distributed
        const baseMonthly = backlog / remainingMonths;

        for (let i = 0; i < remainingMonths; i++) {
          const monthDate = addMonths(now, i);
          const monthKey = format(monthDate, 'yyyy-MM');
          const yearKey = String(monthDate.getFullYear());

          // Apply contour multiplier to get weighted monthly revenue
          const monthRevenue = baseMonthly * multipliers[i];

          // Add to monthly bucket (for individual month columns)
          monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + monthRevenue);

          // Only add to year bucket for months AFTER the 12-month individual view
          // This prevents double-counting in the totals
          if (monthDate > twelveMonthsOut) {
            monthlyRevenue.set(yearKey, (monthlyRevenue.get(yearKey) || 0) + monthRevenue);
          }
        }
      }

      results.push({
        contract,
        monthlyBurnRate,
        remainingMonths,
        projectedEndDate,
        monthlyRevenue,
        contour,
        isAutoContour,
        pctComplete,
      });
    }

    // Sort by projected revenue descending
    results.sort((a, b) => parseNum(b.contract.projected_revenue) - parseNum(a.contract.projected_revenue));

    return results;
  }, [contracts, departmentFilter, marketFilter, pmFilter, statusFilter, searchFilter, adjustedEndMonths, selectedContours, durationRules]);

  // Calculate column totals
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

  // Calculate grand total
  const grandTotal = useMemo(() => {
    let total = 0;
    projections.forEach(p => {
      total += parseNum(p.contract.backlog);
    });
    return total;
  }, [projections]);

  if (isLoading) {
    return <div className="loading">Loading contracts...</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <Link to="/projects" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.8rem' }}>&larr; Projects</Link>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem' }}>Projected Revenue</h2>
          <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
            {projections.length} projects | Total Backlog: {fmt(grandTotal)}
          </div>
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            >
              <option value="all">Open + Soft-Closed</option>
              <option value="Open">Open Only</option>
              <option value="Soft-Closed">Soft-Closed Only</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            >
              <option value="">All Departments</option>
              {filterOptions.departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
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
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Project Manager</label>
            <select
              value={pmFilter}
              onChange={(e) => setPmFilter(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            >
              <option value="">All PMs</option>
              {filterOptions.pms.map(pm => (
                <option key={pm} value={pm}>{pm}</option>
              ))}
            </select>
          </div>

          {(searchFilter || departmentFilter || marketFilter || pmFilter || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchFilter('');
                setDepartmentFilter('');
                setMarketFilter('');
                setPmFilter('');
                setStatusFilter('all');
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                cursor: 'pointer',
                marginTop: '1rem'
              }}
            >
              Clear Filters
            </button>
          )}

          {/* View Toggle and Settings */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                background: showSettings ? '#f59e0b' : '#f1f5f9',
                color: showSettings ? '#fff' : '#64748b',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
              Duration Rules
            </button>
            <div style={{ display: 'flex', gap: '0' }}>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  background: viewMode === 'table' ? '#3b82f6' : '#f1f5f9',
                  color: viewMode === 'table' ? '#fff' : '#64748b',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px 0 0 4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/>
                  <line x1="3" y1="15" x2="21" y2="15"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
                Table
              </button>
              <button
                onClick={() => setViewMode('graph')}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  background: viewMode === 'graph' ? '#3b82f6' : '#f1f5f9',
                  color: viewMode === 'graph' ? '#fff' : '#64748b',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0 4px 4px 0',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                Graph
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Duration Rules Settings Panel */}
      {showSettings && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: '#fffbeb', border: '1px solid #fcd34d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400e', margin: 0 }}>
              Project Duration Rules by Contract Value
            </h3>
            <button
              onClick={() => setDurationRules(defaultDurationRules)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.7rem',
                background: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#92400e'
              }}
            >
              Reset to Defaults
            </button>
          </div>
          <p style={{ fontSize: '0.7rem', color: '#78716c', marginBottom: '0.75rem', margin: '0 0 0.75rem 0' }}>
            These rules determine the expected project duration based on contract value.
            Remaining months are calculated from % complete. You can still override individual projects with the End dropdown.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {durationRules.map((rule, index) => (
              <div
                key={index}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#1e293b' }}>
                  {rule.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.7rem', color: '#64748b' }}>Duration:</label>
                  <input
                    type="number"
                    min="1"
                    max="36"
                    value={rule.months}
                    onChange={(e) => {
                      const newMonths = parseInt(e.target.value) || 1;
                      setDurationRules(rules => rules.map((r, i) =>
                        i === index ? { ...r, months: Math.max(1, Math.min(36, newMonths)) } : r
                      ));
                    }}
                    style={{
                      width: '50px',
                      padding: '0.25rem 0.35rem',
                      fontSize: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}
                  />
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>months</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', position: 'sticky', left: 0, background: '#f8fafc', minWidth: '200px' }}>Project</th>
              <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', minWidth: '70px' }}>Backlog</th>
              <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', minWidth: '60px' }}>% Comp</th>
              <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '60px' }}>End</th>
              <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '80px' }}>Contour</th>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{
                    padding: '0.5rem',
                    textAlign: 'right',
                    borderBottom: '2px solid #e2e8f0',
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
              <tr key={p.contract.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.4rem 0.5rem', position: 'sticky', left: 0, background: '#fff' }}>
                  <div style={{ fontWeight: 500 }}>
                    {p.contract.linked_project_id ? (
                      <Link to={`/projects/${p.contract.linked_project_id}`} style={{ color: '#1e40af', textDecoration: 'none' }}>
                        {p.contract.contract_number}
                      </Link>
                    ) : (
                      p.contract.contract_number
                    )}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                    {p.contract.description || p.contract.customer_name}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                    {p.contract.project_manager_name} | {p.contract.department_code}
                  </div>
                </td>
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>
                  {fmtCompact(parseNum(p.contract.backlog))}
                </td>
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#64748b' }}>
                  {(() => {
                    const earned = parseNum(p.contract.earned_revenue);
                    const projected = parseNum(p.contract.projected_revenue);
                    if (projected === 0) return '-';
                    const pct = (earned / projected) * 100;
                    return `${pct.toFixed(0)}%`;
                  })()}
                </td>
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.65rem' }}>
                  {parseNum(p.contract.backlog) > 0 ? (
                    <select
                      value={p.remainingMonths}
                      onChange={(e) => {
                        const newMonths = parseInt(e.target.value);
                        setAdjustedEndMonths(prev => ({
                          ...prev,
                          [p.contract.id]: newMonths
                        }));
                      }}
                      style={{
                        padding: '0.15rem 0.25rem',
                        fontSize: '0.65rem',
                        border: adjustedEndMonths[p.contract.id] !== undefined ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                        borderRadius: '3px',
                        background: adjustedEndMonths[p.contract.id] !== undefined ? '#eff6ff' : 'transparent',
                        color: '#64748b',
                        cursor: 'pointer',
                        width: '65px'
                      }}
                      title="Click to adjust end date"
                    >
                      {Array.from({ length: 36 }, (_, i) => i + 1).map(months => {
                        const endDate = addMonths(startOfMonth(new Date()), months);
                        return (
                          <option key={months} value={months}>
                            {format(endDate, 'MMM yy')}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    '-'
                  )}
                </td>
                <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                  {parseNum(p.contract.backlog) > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                      <ContourVisual contour={p.contour} />
                      <select
                        value={p.contour}
                        onChange={(e) => {
                          const newContour = e.target.value as ContourType;
                          setSelectedContours(prev => ({
                            ...prev,
                            [p.contract.id]: newContour
                          }));
                        }}
                        style={{
                          padding: '0.15rem 0.25rem',
                          fontSize: '0.65rem',
                          border: p.isAutoContour
                            ? '1px dashed #94a3b8'  // Dashed border for auto-selected
                            : '1px solid #3b82f6', // Solid blue for user-selected
                          borderRadius: '3px',
                          background: p.isAutoContour ? '#f8fafc' : '#eff6ff',
                          cursor: 'pointer',
                          width: '55px',
                          fontStyle: p.isAutoContour ? 'italic' : 'normal'
                        }}
                        title={p.isAutoContour
                          ? `Auto-selected based on ${p.pctComplete.toFixed(0)}% complete. Click to override.`
                          : 'User-selected contour. Click to change.'}
                      >
                        {contourOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                {columns.map(col => {
                  const value = p.monthlyRevenue.get(col.key) || 0;
                  return (
                    <td
                      key={col.key}
                      style={{
                        padding: '0.4rem 0.5rem',
                        textAlign: 'right',
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
                TOTAL ({projections.length} projects)
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                {fmtCompact(grandTotal)}
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'right' }}>-</td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>-</td>
              <td style={{ padding: '0.5rem', textAlign: 'center' }}>-</td>
              {columns.map(col => (
                <td
                  key={col.key}
                  style={{
                    padding: '0.5rem',
                    textAlign: 'right',
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
        <strong>How projections work:</strong> Backlog is spread from now until the End date using the Work Contour.
        Default end date is based on contract value and % complete (see Duration Rules). Click the Duration Rules button to adjust thresholds.
        <br />
        <strong>End dates:</strong> Click to change when a project completes.
        <strong style={{ marginLeft: '1rem' }}>Contours:</strong> Auto-selected based on % complete (<span style={{ fontStyle: 'italic', border: '1px dashed #94a3b8', padding: '0 2px', borderRadius: '2px' }}>dashed</span>), or manually override (<span style={{ border: '1px solid #3b82f6', padding: '0 2px', borderRadius: '2px', background: '#eff6ff' }}>solid blue</span>).
        <div style={{ marginTop: '0.5rem' }}>
          <strong>Work Contours:</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', marginTop: '0.25rem' }}>
            <span><ContourVisual contour="flat" />Flat (even)</span>
            <span><ContourVisual contour="front" />Front (early taper)</span>
            <span><ContourVisual contour="back" />Back (late taper)</span>
            <span><ContourVisual contour="bell" />Bell (middle peak)</span>
            <span><ContourVisual contour="turtle" />Turtle (slow ends)</span>
            <span><ContourVisual contour="double" />Double (two peaks)</span>
            <span><ContourVisual contour="early" />Early Pk (sharp early)</span>
            <span><ContourVisual contour="late" />Late Pk (sharp late)</span>
            <span><ContourVisual contour="scurve" />S-Curve (construction)</span>
            <span><ContourVisual contour="rampup" />Ramp Up (0→max)</span>
            <span><ContourVisual contour="rampdown" />Ramp Dn (max→0)</span>
          </div>
        </div>
        {(Object.keys(adjustedEndMonths).length > 0 || Object.values(selectedContours).some(c => c !== 'flat')) && (
          <div style={{ marginTop: '0.5rem' }}>
            {Object.keys(adjustedEndMonths).length > 0 && (
              <button
                onClick={() => setAdjustedEndMonths({})}
                style={{
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.65rem',
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  color: '#dc2626',
                  marginRight: '0.5rem'
                }}
              >
                Reset end dates ({Object.keys(adjustedEndMonths).length})
              </button>
            )}
            {Object.values(selectedContours).some(c => c !== 'flat') && (
              <button
                onClick={() => setSelectedContours({})}
                style={{
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.65rem',
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  color: '#dc2626'
                }}
              >
                Reset contours ({Object.values(selectedContours).filter(c => c !== 'flat').length})
              </button>
            )}
          </div>
        )}
      </div>
      </>
      )}

      {/* Graph View */}
      {viewMode === 'graph' && (
        <div className="card" style={{ padding: '1rem' }}>
          {/* Monthly Revenue Chart */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
              Projected Revenue by Month (Next 36 Months)
              {departmentFilter === '10-30' && (
                <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b', marginLeft: '1rem' }}>
                  vs. $115M Annual Budget
                </span>
              )}
            </h3>
            <div style={{ height: '320px', position: 'relative' }}>
              {(() => {
                // Generate all 36 months of data
                const now = startOfMonth(new Date());
                const monthlyData: { label: string; value: number; key: string }[] = [];
                let maxValue = 0;

                // Budget for 10-30 department: $115M/year = ~$9.58M/month
                const annualBudget = 115000000;
                const monthlyBudget = annualBudget / 12;
                const showBudget = departmentFilter === '10-30';

                for (let i = 0; i < 36; i++) {
                  const monthDate = addMonths(now, i);
                  const key = format(monthDate, 'yyyy-MM');
                  let total = 0;
                  projections.forEach(p => {
                    total += p.monthlyRevenue.get(key) || 0;
                  });
                  monthlyData.push({
                    label: format(monthDate, 'MMM yy'),
                    value: total,
                    key
                  });
                  if (total > maxValue) maxValue = total;
                }

                // If showing budget, make sure max value includes it
                if (showBudget && monthlyBudget > maxValue) {
                  maxValue = monthlyBudget;
                }

                const barWidth = 100 / 36;
                const chartHeight = 250;

                // Find year boundaries for vertical lines and labels
                const yearBoundaries: { index: number; year: string }[] = [];
                monthlyData.forEach((d, i) => {
                  if (d.key.endsWith('-01')) {
                    yearBoundaries.push({ index: i, year: d.key.substring(0, 4) });
                  }
                });

                return (
                  <svg width="100%" height={chartHeight + 50} style={{ overflow: 'visible' }}>
                    {/* Y-axis labels */}
                    <text x="0" y="10" fontSize="10" fill="#64748b">{fmtCompact(maxValue)}</text>
                    <text x="0" y={chartHeight / 2} fontSize="10" fill="#64748b">{fmtCompact(maxValue / 2)}</text>
                    <text x="0" y={chartHeight} fontSize="10" fill="#64748b">$0</text>

                    {/* Budget line if 10-30 is selected */}
                    {showBudget && (
                      <line
                        x1="40"
                        y1={chartHeight - (monthlyBudget / maxValue) * chartHeight}
                        x2="100%"
                        y2={chartHeight - (monthlyBudget / maxValue) * chartHeight}
                        stroke="#f59e0b"
                        strokeWidth="2"
                        strokeDasharray="6,3"
                      />
                    )}

                    {/* Grid lines */}
                    <line x1="40" y1="0" x2="100%" y2="0" stroke="#e2e8f0" strokeDasharray="2,2" />
                    <line x1="40" y1={chartHeight / 2} x2="100%" y2={chartHeight / 2} stroke="#e2e8f0" strokeDasharray="2,2" />
                    <line x1="40" y1={chartHeight} x2="100%" y2={chartHeight} stroke="#e2e8f0" />

                    {/* Bars and labels */}
                    <g transform="translate(45, 0)">
                      {/* Year boundary vertical lines */}
                      {yearBoundaries.map(yb => {
                        const xPos = `${(yb.index / 36) * 95}%`;
                        return (
                          <line
                            key={`year-line-${yb.year}`}
                            x1={xPos}
                            y1="0"
                            x2={xPos}
                            y2={chartHeight + 5}
                            stroke="#94a3b8"
                            strokeWidth="1"
                            strokeDasharray="4,2"
                          />
                        );
                      })}

                      {monthlyData.map((d, i) => {
                        const barHeight = maxValue > 0 ? (d.value / maxValue) * chartHeight : 0;
                        const budgetHeight = maxValue > 0 ? (monthlyBudget / maxValue) * chartHeight : 0;
                        const xPercent = (i / 36) * 95;
                        const isYearStart = d.key.endsWith('-01');
                        const monthAbbr = d.label.substring(0, 3); // Just the month
                        const showMonth = i % 3 === 0; // Show every 3rd month
                        const isOverBudget = showBudget && d.value > monthlyBudget;
                        const isUnderBudget = showBudget && d.value < monthlyBudget;

                        return (
                          <g key={d.key}>
                            {/* Budget bar (background) */}
                            {showBudget && (
                              <rect
                                x={`${xPercent}%`}
                                y={chartHeight - budgetHeight}
                                width={`${barWidth * 0.8}%`}
                                height={budgetHeight}
                                fill="#fef3c7"
                                rx="1"
                              >
                                <title>Budget: {fmtCompact(monthlyBudget)}</title>
                              </rect>
                            )}
                            {/* Revenue bar */}
                            <rect
                              x={`${xPercent}%`}
                              y={chartHeight - barHeight}
                              width={`${barWidth * 0.8}%`}
                              height={barHeight}
                              fill={isOverBudget ? '#ef4444' : isUnderBudget ? '#10b981' : (isYearStart ? '#1e40af' : '#3b82f6')}
                              rx="1"
                            >
                              <title>{d.label}: {fmtCompact(d.value)}{showBudget ? ` (Budget: ${fmtCompact(monthlyBudget)})` : ''}</title>
                            </rect>
                            {/* Month labels - every 3 months */}
                            {showMonth && (
                              <text
                                x={`${xPercent + barWidth * 0.4}%`}
                                y={chartHeight + 14}
                                fontSize="9"
                                fill="#64748b"
                                textAnchor="middle"
                              >
                                {monthAbbr}
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* Year labels below the chart */}
                      {yearBoundaries.map((yb, idx) => {
                        const xStart = (yb.index / 36) * 95;
                        const nextBoundary = yearBoundaries[idx + 1];
                        const xEnd = nextBoundary ? (nextBoundary.index / 36) * 95 : 95;
                        const xCenter = (xStart + xEnd) / 2;
                        return (
                          <text
                            key={`year-label-${yb.year}`}
                            x={`${xCenter}%`}
                            y={chartHeight + 32}
                            fontSize="11"
                            fontWeight="600"
                            fill="#1e293b"
                            textAnchor="middle"
                          >
                            {yb.year}
                          </text>
                        );
                      })}
                      {/* Label for months before first January */}
                      {yearBoundaries.length > 0 && yearBoundaries[0].index > 0 && (
                        <text
                          x={`${(yearBoundaries[0].index / 36) * 95 / 2}%`}
                          y={chartHeight + 32}
                          fontSize="11"
                          fontWeight="600"
                          fill="#1e293b"
                          textAnchor="middle"
                        >
                          {monthlyData[0].key.substring(0, 4)}
                        </text>
                      )}
                    </g>
                  </svg>
                );
              })()}
            </div>
            {/* Budget legend when 10-30 is selected */}
            {departmentFilter === '10-30' && (
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.7rem', color: '#64748b', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '2px' }}></span>
                  Budget ($9.58M/mo)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#10b981', borderRadius: '2px' }}></span>
                  Under Budget
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }}></span>
                  Over Budget
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ display: 'inline-block', width: '16px', height: '2px', background: '#f59e0b', borderRadius: '1px' }}></span>
                  Budget Line
                </span>
              </div>
            )}
          </div>

          {/* Yearly Revenue Chart */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
              Projected Revenue by Year
            </h3>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', height: '200px' }}>
              {(() => {
                const now = startOfMonth(new Date());
                const currentYear = now.getFullYear();
                const yearTotals: { year: number; total: number }[] = [];
                let maxYearValue = 0;

                // Calculate totals for each year (current year + next 3 years)
                for (let y = 0; y < 4; y++) {
                  const year = currentYear + y;
                  let yearTotal = 0;

                  // Sum all months in this year
                  for (let m = 0; m < 12; m++) {
                    const monthDate = new Date(year, m, 1);
                    // Only count future months
                    if (monthDate >= now) {
                      const key = format(monthDate, 'yyyy-MM');
                      projections.forEach(p => {
                        yearTotal += p.monthlyRevenue.get(key) || 0;
                      });
                    }
                  }

                  yearTotals.push({ year, total: yearTotal });
                  if (yearTotal > maxYearValue) maxYearValue = yearTotal;
                }

                return yearTotals.map((yd, i) => {
                  const barHeight = maxYearValue > 0 ? (yd.total / maxYearValue) * 160 : 0;
                  const colors = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd'];
                  return (
                    <div key={yd.year} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>
                        {fmtCompact(yd.total)}
                      </div>
                      <div
                        style={{
                          width: '60%',
                          height: `${barHeight}px`,
                          background: colors[i],
                          borderRadius: '4px 4px 0 0',
                          minHeight: yd.total > 0 ? '4px' : '0'
                        }}
                        title={`${yd.year}: ${fmt(yd.total)}`}
                      />
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: '#64748b',
                        marginTop: '0.5rem',
                        padding: '0.25rem 0.5rem',
                        background: i === 0 ? '#eff6ff' : 'transparent',
                        borderRadius: '4px'
                      }}>
                        {yd.year}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Revenue by Department Chart */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
              Total Backlog by Department
            </h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {(() => {
                const deptTotals: Record<string, number> = {};
                projections.forEach(p => {
                  const dept = p.contract.department_code || 'Unknown';
                  deptTotals[dept] = (deptTotals[dept] || 0) + parseNum(p.contract.backlog);
                });

                const sortedDepts = Object.entries(deptTotals)
                  .sort((a, b) => b[1] - a[1]);
                const maxDept = sortedDepts[0]?.[1] || 1;

                return sortedDepts.map(([dept, total]) => (
                  <div key={dept} style={{ flex: '1', minWidth: '150px', maxWidth: '250px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 500 }}>{dept}</span>
                      <span style={{ color: '#64748b' }}>{fmtCompact(total)}</span>
                    </div>
                    <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(total / maxDept) * 100}%`,
                          background: '#3b82f6',
                          height: '100%',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Revenue by PM Chart */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
              Total Backlog by Project Manager (Top 10)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(() => {
                const pmTotals: Record<string, number> = {};
                projections.forEach(p => {
                  const pm = p.contract.project_manager_name || 'Unassigned';
                  pmTotals[pm] = (pmTotals[pm] || 0) + parseNum(p.contract.backlog);
                });

                const sortedPMs = Object.entries(pmTotals)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10);
                const maxPM = sortedPMs[0]?.[1] || 1;

                return sortedPMs.map(([pm, total]) => (
                  <div key={pm} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '120px', fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pm}
                    </div>
                    <div style={{ flex: 1, background: '#e2e8f0', borderRadius: '4px', height: '16px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${(total / maxPM) * 100}%`,
                          background: '#10b981',
                          height: '100%',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: '0.5rem'
                        }}
                      >
                        <span style={{ fontSize: '0.65rem', color: '#fff', fontWeight: 500 }}>{fmtCompact(total)}</span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Quarterly Summary */}
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>
              Projected Revenue by Quarter
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem' }}>
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
                      total += p.monthlyRevenue.get(key) || 0;
                    });
                  }
                  const qStart = addMonths(now, startMonth);
                  const year = qStart.getFullYear();
                  const qNum = Math.floor(qStart.getMonth() / 3) + 1;
                  quarters.push({ label: `Q${qNum} ${year}`, total });
                }

                return quarters.map((q, i) => (
                  <div
                    key={i}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>{q.label}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{fmtCompact(q.total)}</div>
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

export default ProjectedRevenue;
