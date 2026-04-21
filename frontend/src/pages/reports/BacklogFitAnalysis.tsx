import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  LineController,
  BarController,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import opportunitiesService, { Opportunity } from '../../services/opportunities';
import { vistaDataService, VPContract } from '../../services/vistaData';
import { format, addMonths, startOfMonth, differenceInMonths, parseISO, isBefore } from 'date-fns';
import { ContourType, getContourMultipliers, getDefaultContour } from '../../utils/contours';
import { getBacklogFitSettings, saveBacklogFitSettings, BacklogFitSettings, RegionTarget } from '../../services/tenant';
import api from '../../services/api';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import { LOCATION_GROUPS } from '../../constants/locationGroups';

const REGIONS = [
  { prefix: '10', label: 'NE Wisconsin', color: '#3b82f6' },
  { prefix: '20', label: 'Central WI', color: '#8b5cf6' },
  { prefix: '30', label: 'Western WI', color: '#f59e0b' },
  { prefix: '40', label: 'Tempe, AZ', color: '#ef4444' },
];

const getLocationGroup = (deptCode: string | null | undefined): string | null => {
  if (!deptCode) return null;
  const prefix = deptCode.substring(0, 2);
  const group = LOCATION_GROUPS.find(g => g.prefix === prefix);
  return group ? group.value : null;
};

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, LineController, BarController, Title, Tooltip, Legend, Filler);

// Formatting helpers
const fmtCompact = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return '-';
  if (isNaN(value)) return '-';
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const parseNum = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
};

const fmtHeadcount = (hours: number, hpp: number): string => {
  if (hours === 0 || isNaN(hours)) return '-';
  const hc = hours / hpp;
  if (hc < 0.1) return '-';
  return hc.toFixed(1);
};

const fmtHoursCompact = (value: number): string => {
  if (value === 0 || isNaN(value)) return '-';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
};

// Duration rules (same as ProjectedRevenue defaults)
interface DurationRule { minValue: number; maxValue: number; months: number; }

const projectDurationRules: DurationRule[] = [
  { minValue: 0, maxValue: 500000, months: 3 },
  { minValue: 500000, maxValue: 2000000, months: 6 },
  { minValue: 2000000, maxValue: 5000000, months: 8 },
  { minValue: 5000000, maxValue: 10000000, months: 12 },
  { minValue: 10000000, maxValue: Infinity, months: 24 },
];

const pursuitRules: DurationRule[] = [
  { minValue: 0, maxValue: 500000, months: 2 },
  { minValue: 500000, maxValue: 2000000, months: 4 },
  { minValue: 2000000, maxValue: 5000000, months: 6 },
  { minValue: 5000000, maxValue: 10000000, months: 9 },
  { minValue: 10000000, maxValue: Infinity, months: 12 },
];

const workDurationRules: DurationRule[] = [
  { minValue: 0, maxValue: 500000, months: 3 },
  { minValue: 500000, maxValue: 2000000, months: 6 },
  { minValue: 2000000, maxValue: 5000000, months: 8 },
  { minValue: 5000000, maxValue: 10000000, months: 12 },
  { minValue: 10000000, maxValue: Infinity, months: 24 },
];

const getDurationForValue = (value: number, rules: DurationRule[]): number => {
  for (const rule of rules) {
    if (value >= rule.minValue && value < rule.maxValue) return rule.months;
  }
  return 24;
};

interface OpportunityFitScore {
  opportunity: Opportunity;
  projectedStart: Date;
  workDuration: number;
  probability: number;
  weightedValue: number;
  weightedHours: number;
  monthlyRevenue: Map<string, number>;
  monthlyLabor: Map<string, number>;
  fitScore: number;
  gapFillPercent: number;
}

const defaultSettings: BacklogFitSettings = {
  capacityTarget: 5000000,
  horizonMonths: 12,
  comparisonMode: 'revenue',
  laborCapacityTarget: 150,
  laborPctOfValue: 60,
  avgLaborRate: 85,
  hoursPerPersonPerMonth: 173,
};

const BacklogFitAnalysis: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useTitanFeedback();
  const [capacityTarget, setCapacityTarget] = useState<number>(defaultSettings.capacityTarget);
  const [horizonMonths, setHorizonMonths] = useState<number>(defaultSettings.horizonMonths);
  const [marketFilter, setMarketFilter] = useState<string>('');
  const [locationGroupFilter, setLocationGroupFilter] = useState<string>('');
  const [comparisonMode, setComparisonMode] = useState<'revenue' | 'labor'>(defaultSettings.comparisonMode);
  const [laborCapacityTarget, setLaborCapacityTarget] = useState<number>(defaultSettings.laborCapacityTarget);
  const [laborPctOfValue, setLaborPctOfValue] = useState<number>(defaultSettings.laborPctOfValue);
  const [avgLaborRate, setAvgLaborRate] = useState<number>(defaultSettings.avgLaborRate);
  const [hoursPerPersonPerMonth, setHoursPerPersonPerMonth] = useState<number>(defaultSettings.hoursPerPersonPerMonth);
  const [regionTargets, setRegionTargets] = useState<{ [prefix: string]: RegionTarget }>({});
  const [showRegionTargets, setShowRegionTargets] = useState(false);
  const settingsLoaded = useRef(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emlLoading, setEmlLoading] = useState(false);

  const handlePdfDownload = useCallback(async () => {
    setPdfLoading(true);
    try {
      const response = await api.get('/backlog-report/pdf-download', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backlog-Fit-Report-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  }, []);

  const handleEmailDraft = useCallback(async () => {
    setEmlLoading(true);
    try {
      const response = await api.get('/backlog-report/email-draft', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'message/rfc822' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backlog-Fit-Report-${new Date().toISOString().split('T')[0]}.eml`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Email draft failed:', err);
    } finally {
      setEmlLoading(false);
    }
  }, []);

  // Load settings from tenant API
  const { data: savedSettings, fetchStatus } = useQuery({
    queryKey: ['backlogFitSettings'],
    queryFn: getBacklogFitSettings,
  });

  // Apply loaded settings to state once after a FRESH fetch completes (not stale cache)
  useEffect(() => {
    if (fetchStatus !== 'idle' || settingsLoaded.current) return;
    settingsLoaded.current = true;
    if (savedSettings) {
      if (savedSettings.capacityTarget != null) setCapacityTarget(savedSettings.capacityTarget);
      if (savedSettings.horizonMonths != null) setHorizonMonths(savedSettings.horizonMonths);
      if (savedSettings.comparisonMode) setComparisonMode(savedSettings.comparisonMode);
      if (savedSettings.laborCapacityTarget != null) setLaborCapacityTarget(savedSettings.laborCapacityTarget);
      if (savedSettings.laborPctOfValue != null) setLaborPctOfValue(savedSettings.laborPctOfValue);
      if (savedSettings.avgLaborRate != null) setAvgLaborRate(savedSettings.avgLaborRate);
      if (savedSettings.hoursPerPersonPerMonth != null) setHoursPerPersonPerMonth(savedSettings.hoursPerPersonPerMonth);
      if (savedSettings.regionTargets) setRegionTargets(savedSettings.regionTargets);
    }
  }, [fetchStatus, savedSettings]);

  // Save settings to tenant API (debounced via mutation)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const saveMutation = useMutation({
    mutationFn: saveBacklogFitSettings,
    onSuccess: (data) => {
      // Keep query cache in sync so navigating away/back preserves saved values
      queryClient.setQueryData(['backlogFitSettings'], data);
    },
  });

  const saveSettings = useCallback((overrides: Partial<BacklogFitSettings> = {}) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMutation.mutate({
        capacityTarget, horizonMonths, comparisonMode,
        laborCapacityTarget, laborPctOfValue, avgLaborRate, hoursPerPersonPerMonth,
        regionTargets,
        ...overrides,
      });
    }, 600);
  }, [capacityTarget, horizonMonths, comparisonMode, laborCapacityTarget, laborPctOfValue, avgLaborRate, hoursPerPersonPerMonth, regionTargets, saveMutation]);

  // Fetch data
  const { data: contracts, isLoading: contractsLoading } = useQuery({
    queryKey: ['vpContracts', 'backlogFit'],
    queryFn: () => vistaDataService.getAllContracts({ status: '' }),
  });

  const { data: opportunities, isLoading: oppsLoading } = useQuery({
    queryKey: ['opportunities', 'backlogFit'],
    queryFn: () => opportunitiesService.getAll(),
  });

  const isLoading = contractsLoading || oppsLoading;

  // Excluded stages for opportunities
  const excludedStageNames = useMemo(() => new Set(['Won', 'Lost', 'Passed', 'Awarded']), []);

  // Generate month keys for the horizon
  const monthKeys = useMemo(() => {
    const now = startOfMonth(new Date());
    return Array.from({ length: horizonMonths }, (_, i) => {
      const d = addMonths(now, i);
      return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM yy') };
    });
  }, [horizonMonths]);

  // Calculate project monthly revenue (same logic as ProjectedRevenue)
  const projectMonthlyRevenue = useMemo(() => {
    const monthly = new Map<string, number>();
    if (!contracts) return monthly;

    const now = startOfMonth(new Date());

    contracts.forEach(c => {
      const status = c.status?.toLowerCase() || '';
      if (!status.includes('open') && !status.includes('soft')) return;
      if (locationGroupFilter && getLocationGroup(c.department_code) !== locationGroupFilter) return;

      const backlog = parseNum(c.backlog);
      if (backlog <= 0) return;

      const earnedRevenue = parseNum(c.earned_revenue);
      const projectedRevenue = parseNum(c.projected_revenue);
      const contractValue = parseNum(c.contract_amount) || projectedRevenue;

      let remainingMonths: number;
      if (c.user_adjusted_end_months != null) {
        remainingMonths = Math.max(1, Math.min(36, c.user_adjusted_end_months));
      } else {
        const totalDuration = getDurationForValue(contractValue, projectDurationRules);
        const pctComplete = projectedRevenue > 0 ? earnedRevenue / projectedRevenue : 0;
        remainingMonths = Math.max(1, Math.min(36, Math.ceil(totalDuration * (1 - pctComplete))));
      }

      const pctComplete = projectedRevenue > 0 ? (earnedRevenue / projectedRevenue) * 100 : 0;
      const contour: ContourType = (c.user_selected_contour as ContourType) || getDefaultContour(pctComplete);
      const multipliers = getContourMultipliers(remainingMonths, contour);
      const baseMonthly = backlog / remainingMonths;

      for (let i = 0; i < remainingMonths; i++) {
        const monthDate = addMonths(now, i);
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthRevenue = baseMonthly * multipliers[i];
        monthly.set(monthKey, (monthly.get(monthKey) || 0) + monthRevenue);
      }
    });

    return monthly;
  }, [contracts, locationGroupFilter]);

  // Calculate project monthly labor hours (same logic as LaborForecast)
  const projectMonthlyLabor = useMemo(() => {
    const monthly = new Map<string, number>();
    if (!contracts) return monthly;

    const now = startOfMonth(new Date());

    contracts.forEach(c => {
      const status = c.status?.toLowerCase() || '';
      if (!status.includes('open') && !status.includes('soft')) return;
      if (locationGroupFilter && getLocationGroup(c.department_code) !== locationGroupFilter) return;

      // Calculate remaining hours per trade
      const pfRemaining = Math.max(0, (parseNum(c.pf_hours_projected) || parseNum(c.pf_hours_estimate)) - parseNum(c.pf_hours_jtd));
      const smRemaining = Math.max(0, (parseNum(c.sm_hours_projected) || parseNum(c.sm_hours_estimate)) - parseNum(c.sm_hours_jtd));
      const plRemaining = Math.max(0, (parseNum(c.pl_hours_projected) || parseNum(c.pl_hours_estimate)) - parseNum(c.pl_hours_jtd));
      const totalRemainingHours = pfRemaining + smRemaining + plRemaining;

      if (totalRemainingHours <= 0) return;

      // Calculate remaining months (same as revenue + labor forecast logic)
      const earnedRevenue = parseNum(c.earned_revenue);
      const projectedRevenue = parseNum(c.projected_revenue);
      const contractValue = parseNum(c.contract_amount) || projectedRevenue;
      const backlog = parseNum(c.backlog);

      let remainingMonths: number;
      if (c.user_adjusted_end_months != null) {
        remainingMonths = Math.max(1, Math.min(36, c.user_adjusted_end_months));
      } else if (backlog > 0) {
        const totalDuration = getDurationForValue(contractValue, projectDurationRules);
        const pctComplete = projectedRevenue > 0 ? earnedRevenue / projectedRevenue : 0;
        remainingMonths = Math.max(1, Math.min(36, Math.ceil(totalDuration * (1 - pctComplete))));
      } else {
        remainingMonths = 3;
      }

      const pctComplete = projectedRevenue > 0 ? (earnedRevenue / projectedRevenue) * 100 : 0;
      const contour: ContourType = (c.user_selected_contour as ContourType) || getDefaultContour(pctComplete);
      const multipliers = getContourMultipliers(remainingMonths, contour);
      const baseMonthly = totalRemainingHours / remainingMonths;

      for (let i = 0; i < remainingMonths; i++) {
        const monthDate = addMonths(now, i);
        const monthKey = format(monthDate, 'yyyy-MM');
        const monthHours = baseMonthly * multipliers[i];
        monthly.set(monthKey, (monthly.get(monthKey) || 0) + monthHours);
      }
    });

    return monthly;
  }, [contracts, locationGroupFilter]);

  // Calculate opportunity projections and fit scores
  const opportunityScores = useMemo(() => {
    if (!opportunities) return [];

    const now = startOfMonth(new Date());
    const results: OpportunityFitScore[] = [];

    // Determine which project data to use for gap calculation based on mode
    const effectiveProjectMonthly = comparisonMode === 'revenue' ? projectMonthlyRevenue : projectMonthlyLabor;
    const effectiveTarget = comparisonMode === 'revenue'
      ? capacityTarget
      : laborCapacityTarget * hoursPerPersonPerMonth;

    // Calculate monthly gaps
    const monthlyGaps = new Map<string, number>();
    monthKeys.forEach(({ key }) => {
      const projectValue = effectiveProjectMonthly.get(key) || 0;
      const gap = Math.max(0, effectiveTarget - projectValue);
      monthlyGaps.set(key, gap);
    });
    const totalGapAcrossMonths = Array.from(monthlyGaps.values()).reduce((s, v) => s + v, 0);

    const filtered = opportunities.filter(o => {
      if (o.stage_name && excludedStageNames.has(o.stage_name)) return false;
      if (!o.estimated_value || parseNum(o.estimated_value) <= 0) return false;
      if (marketFilter && o.market !== marketFilter) return false;
      if (locationGroupFilter && o.location_group !== locationGroupFilter) return false;
      return true;
    });

    for (const opp of filtered) {
      const estimatedValue = parseNum(opp.estimated_value);
      // Map qualitative probability override to numeric, else use stage probability
      const qualitativeProbMap: Record<string, number> = { 'High': 75, 'Medium': 50, 'Low': 25 };
      const probability = opp.probability && qualitativeProbMap[opp.probability]
        ? qualitativeProbMap[opp.probability]
        : parseNum(opp.stage_probability);
      const weightedValue = estimatedValue * (probability / 100);

      // Estimate labor hours: apply labor % of value, then divide by labor rate
      const laborValue = estimatedValue * (laborPctOfValue / 100);
      const estimatedHours = laborValue / avgLaborRate;
      const weightedHours = estimatedHours * (probability / 100);

      // Determine start date
      let projectedStart: Date;
      if (opp.user_adjusted_start_date) {
        projectedStart = startOfMonth(parseISO(opp.user_adjusted_start_date));
      } else if (opp.estimated_start_date && !isBefore(parseISO(opp.estimated_start_date), now)) {
        projectedStart = startOfMonth(parseISO(opp.estimated_start_date));
      } else {
        const pursuitMonths = getDurationForValue(estimatedValue, pursuitRules);
        projectedStart = addMonths(now, pursuitMonths);
      }

      // Determine duration
      let workDuration: number;
      if (opp.user_adjusted_duration_months != null) {
        workDuration = opp.user_adjusted_duration_months;
      } else if (opp.estimated_duration_days) {
        workDuration = Math.max(1, Math.round(parseNum(opp.estimated_duration_days) / 30));
      } else {
        workDuration = getDurationForValue(estimatedValue, workDurationRules);
      }
      workDuration = Math.max(1, Math.min(36, workDuration));

      // Distribute revenue and labor hours across months
      const contour: ContourType = (opp.contour_type as ContourType) || 'scurve';
      const multipliers = getContourMultipliers(workDuration, contour);
      const baseMonthlyRevenue = weightedValue / workDuration;
      const baseMonthlyLabor = weightedHours / workDuration;
      const monthsUntilStart = Math.max(0, differenceInMonths(projectedStart, now));

      const monthlyRevenue = new Map<string, number>();
      const monthlyLabor = new Map<string, number>();
      let effectiveInGapMonths = 0;
      let totalEffective = 0;

      for (let i = 0; i < workDuration; i++) {
        const monthDate = addMonths(now, monthsUntilStart + i);
        const monthKey = format(monthDate, 'yyyy-MM');

        const monthRevenue = baseMonthlyRevenue * multipliers[i];
        const monthLabor = baseMonthlyLabor * multipliers[i];

        monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + monthRevenue);
        monthlyLabor.set(monthKey, (monthlyLabor.get(monthKey) || 0) + monthLabor);

        // Use appropriate metric for gap fill scoring
        const monthEffective = comparisonMode === 'revenue' ? monthRevenue : monthLabor;
        totalEffective += monthEffective;

        const gap = monthlyGaps.get(monthKey) || 0;
        if (gap > 0) {
          effectiveInGapMonths += Math.min(monthEffective, gap);
        }
      }

      // Calculate fit score (0-100)
      const gapFillPercent = totalGapAcrossMonths > 0
        ? (effectiveInGapMonths / totalGapAcrossMonths) * 100
        : 0;

      // Gap fill weight (60%): how much of this opportunity's value fills gaps
      const gapFillScore = totalEffective > 0 ? (effectiveInGapMonths / totalEffective) * 100 : 0;

      // Probability weight (30%): higher probability = higher score
      const probScore = probability;

      // Size fit (10%): prefer opportunities that don't massively exceed total gap
      const effectiveWeighted = comparisonMode === 'revenue' ? weightedValue : weightedHours;
      const sizeFit = totalGapAcrossMonths > 0
        ? Math.min(100, (1 - Math.abs(effectiveWeighted - totalGapAcrossMonths / filtered.length) / totalGapAcrossMonths) * 100)
        : 50;

      const fitScore = Math.max(0, Math.min(100,
        (gapFillScore * 0.6) + (probScore * 0.3) + (Math.max(0, sizeFit) * 0.1)
      ));

      results.push({
        opportunity: opp,
        projectedStart,
        workDuration,
        probability,
        weightedValue,
        weightedHours,
        monthlyRevenue,
        monthlyLabor,
        fitScore,
        gapFillPercent,
      });
    }

    // Sort by fit score descending
    results.sort((a, b) => b.fitScore - a.fitScore);
    return results;
  }, [opportunities, projectMonthlyRevenue, projectMonthlyLabor, capacityTarget, laborCapacityTarget, hoursPerPersonPerMonth, laborPctOfValue, avgLaborRate, comparisonMode, monthKeys, marketFilter, locationGroupFilter, excludedStageNames]);

  // Opportunity monthly totals (revenue)
  const oppMonthlyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    opportunityScores.forEach(s => {
      s.monthlyRevenue.forEach((value, key) => {
        totals.set(key, (totals.get(key) || 0) + value);
      });
    });
    return totals;
  }, [opportunityScores]);

  // Opportunity monthly totals (labor hours)
  const oppMonthlyLaborTotals = useMemo(() => {
    const totals = new Map<string, number>();
    opportunityScores.forEach(s => {
      s.monthlyLabor.forEach((value, key) => {
        totals.set(key, (totals.get(key) || 0) + value);
      });
    });
    return totals;
  }, [opportunityScores]);

  // Effective monthly data based on comparison mode
  const effectiveProjectMonthly = comparisonMode === 'revenue' ? projectMonthlyRevenue : projectMonthlyLabor;
  const effectiveOppMonthly = comparisonMode === 'revenue' ? oppMonthlyTotals : oppMonthlyLaborTotals;
  const effectiveTarget = comparisonMode === 'revenue' ? capacityTarget : laborCapacityTarget * hoursPerPersonPerMonth;

  // Chart data
  const chartData = useMemo((): any => {
    const isRevenue = comparisonMode === 'revenue';
    const projectData = isRevenue
      ? monthKeys.map(m => (projectMonthlyRevenue.get(m.key) || 0) / 1000000)
      : monthKeys.map(m => (projectMonthlyLabor.get(m.key) || 0) / hoursPerPersonPerMonth);
    const oppData = isRevenue
      ? monthKeys.map(m => (oppMonthlyTotals.get(m.key) || 0) / 1000000)
      : monthKeys.map(m => (oppMonthlyLaborTotals.get(m.key) || 0) / hoursPerPersonPerMonth);
    const targetData = isRevenue
      ? monthKeys.map(() => capacityTarget / 1000000)
      : monthKeys.map(() => laborCapacityTarget);

    return {
      labels: monthKeys.map(m => m.label),
      datasets: [
        {
          type: 'bar',
          label: isRevenue ? 'Project Backlog (committed)' : 'Project Labor (committed)',
          data: projectData,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: 'rgba(59, 130, 246, 0.9)',
          borderWidth: 1,
          order: 2,
        },
        {
          type: 'bar',
          label: isRevenue ? 'Opportunity Pipeline (speculative)' : 'Opportunity Labor (speculative)',
          data: oppData,
          backgroundColor: 'rgba(34, 197, 94, 0.25)',
          borderColor: 'rgba(34, 197, 94, 0.7)',
          borderWidth: 2,
          borderDash: [4, 2],
          order: 1,
        },
        {
          type: 'line',
          label: isRevenue ? 'Capacity Target' : 'Headcount Target',
          data: targetData,
          borderColor: '#ef4444',
          borderDash: [6, 3],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          order: 0,
        },
      ],
    };
  }, [comparisonMode, monthKeys, projectMonthlyRevenue, projectMonthlyLabor, oppMonthlyTotals, oppMonthlyLaborTotals, capacityTarget, laborCapacityTarget, hoursPerPersonPerMonth]);

  const chartOptions = useMemo((): any => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      x: { grid: { display: false } },
      y: {
        title: { display: true, text: comparisonMode === 'revenue' ? 'Revenue ($M)' : 'Headcount (people)' },
        ticks: {
          callback: comparisonMode === 'revenue'
            ? (value: any) => `$${value}M`
            : (value: any) => `${value}`,
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: comparisonMode === 'revenue'
            ? (ctx: any) => `${ctx.dataset.label}: ${fmtCompact(ctx.raw * 1000000)}`
            : (ctx: any) => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)} people`,
        },
      },
      legend: { position: 'top' as const },
    },
  }), [comparisonMode]);

  // Market options from opportunities
  const marketOptions = useMemo(() => {
    if (!opportunities) return [];
    const markets = new Set<string>();
    opportunities.forEach(o => { if (o.market) markets.add(o.market); });
    return Array.from(markets).sort();
  }, [opportunities]);


  // Summary stats
  const summaryStats = useMemo(() => {
    if (comparisonMode === 'revenue') {
      const gapMonths = monthKeys.filter(m => {
        const projectRev = projectMonthlyRevenue.get(m.key) || 0;
        return projectRev < capacityTarget;
      }).length;

      const totalProjectValue = monthKeys.reduce((sum, m) => sum + (projectMonthlyRevenue.get(m.key) || 0), 0);
      const totalOppValue = monthKeys.reduce((sum, m) => sum + (oppMonthlyTotals.get(m.key) || 0), 0);
      const totalCapacity = capacityTarget * horizonMonths;
      const totalGap = Math.max(0, totalCapacity - totalProjectValue);

      return { gapMonths, totalProjectValue, totalOppValue, totalCapacity, totalGap };
    } else {
      const laborTarget = laborCapacityTarget * hoursPerPersonPerMonth;
      const gapMonths = monthKeys.filter(m => {
        const projectHours = projectMonthlyLabor.get(m.key) || 0;
        return projectHours < laborTarget;
      }).length;

      const totalProjectValue = monthKeys.reduce((sum, m) => sum + (projectMonthlyLabor.get(m.key) || 0), 0);
      const totalOppValue = monthKeys.reduce((sum, m) => sum + (oppMonthlyLaborTotals.get(m.key) || 0), 0);
      const totalCapacity = laborTarget * horizonMonths;
      const totalGap = Math.max(0, totalCapacity - totalProjectValue);

      return { gapMonths, totalProjectValue, totalOppValue, totalCapacity, totalGap };
    }
  }, [comparisonMode, monthKeys, projectMonthlyRevenue, projectMonthlyLabor, oppMonthlyTotals, oppMonthlyLaborTotals, capacityTarget, laborCapacityTarget, hoursPerPersonPerMonth, horizonMonths]);

  if (isLoading) {
    return <div className="loading">Loading backlog data...</div>;
  }

  const getFitColor = (score: number) => {
    if (score >= 60) return '#16a34a';
    if (score >= 30) return '#ca8a04';
    return '#dc2626';
  };

  const getFitBg = (score: number) => {
    if (score >= 60) return '#dcfce7';
    if (score >= 30) return '#fef9c3';
    return '#fee2e2';
  };

  // Format helper based on mode
  const fmtValue = (value: number): string => {
    if (comparisonMode === 'revenue') return fmtCompact(value);
    return fmtHeadcount(value, hoursPerPersonPerMonth);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <Link to="/sales/projected-revenue" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.8rem' }}>&larr; Opportunity Revenue Forecast</Link>
          <h2 style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem' }}>Backlog Fit Analysis</h2>
          <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
            Comparing project {comparisonMode === 'revenue' ? 'backlog' : 'labor curve'} vs. opportunity pipeline to identify capacity gaps
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handlePdfDownload}
            disabled={pdfLoading}
            style={{
              padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: '4px', cursor: pdfLoading ? 'wait' : 'pointer',
              opacity: pdfLoading ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            {pdfLoading ? 'Generating...' : 'Download Report'}
          </button>
          <button
            onClick={handleEmailDraft}
            disabled={emlLoading}
            style={{
              padding: '0.4rem 0.75rem', fontSize: '0.75rem', background: '#f8fafc', color: '#334155',
              border: '1px solid #e2e8f0', borderRadius: '4px', cursor: emlLoading ? 'wait' : 'pointer',
              opacity: emlLoading ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            {emlLoading ? 'Generating...' : 'Email Draft'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>
            {comparisonMode === 'revenue' ? `Project Backlog (${horizonMonths}mo)` : `Project Labor (${horizonMonths}mo)`}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#3b82f6' }}>
            {comparisonMode === 'revenue'
              ? fmtCompact(summaryStats.totalProjectValue)
              : `${fmtHeadcount(summaryStats.totalProjectValue / horizonMonths, hoursPerPersonPerMonth)} avg`
            }
          </div>
          {comparisonMode === 'labor' && (
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{fmtHoursCompact(summaryStats.totalProjectValue)} total hours</div>
          )}
        </div>
        <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>
            {comparisonMode === 'revenue' ? 'Opportunity Pipeline (wtd)' : 'Opp. Labor Est. (wtd)'}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#22c55e' }}>
            {comparisonMode === 'revenue'
              ? fmtCompact(summaryStats.totalOppValue)
              : `${fmtHeadcount(summaryStats.totalOppValue / horizonMonths, hoursPerPersonPerMonth)} avg`
            }
          </div>
          {comparisonMode === 'labor' && (
            <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{fmtHoursCompact(summaryStats.totalOppValue)} total hours</div>
          )}
        </div>
        <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>
            {comparisonMode === 'revenue' ? `Capacity Target (${horizonMonths}mo)` : `Headcount Target (${horizonMonths}mo)`}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#64748b' }}>
            {comparisonMode === 'revenue'
              ? fmtCompact(summaryStats.totalCapacity)
              : `${laborCapacityTarget} people`
            }
          </div>
        </div>
        <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>
            {comparisonMode === 'revenue' ? 'Backlog Gap' : 'Labor Gap'}
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: summaryStats.totalGap > 0 ? '#ef4444' : '#16a34a' }}>
            {summaryStats.totalGap > 0
              ? (comparisonMode === 'revenue'
                ? fmtCompact(summaryStats.totalGap)
                : `${fmtHeadcount(summaryStats.totalGap / horizonMonths, hoursPerPersonPerMonth)} avg`)
              : 'Covered'
            }
          </div>
        </div>
        <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.25rem' }}>Months Under Capacity</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: summaryStats.gapMonths > 0 ? '#f59e0b' : '#16a34a' }}>
            {summaryStats.gapMonths} / {horizonMonths}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Comparison Mode Toggle */}
          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Compare By</label>
            <div style={{ display: 'flex', gap: '0' }}>
              <button
                onClick={() => { setComparisonMode('revenue'); saveSettings({ comparisonMode: 'revenue' }); }}
                style={{
                  padding: '0.35rem 0.75rem', fontSize: '0.8rem',
                  background: comparisonMode === 'revenue' ? '#3b82f6' : '#f1f5f9',
                  color: comparisonMode === 'revenue' ? '#fff' : '#64748b',
                  border: '1px solid #e2e8f0', borderRadius: '4px 0 0 4px', cursor: 'pointer',
                }}
              >
                Revenue
              </button>
              <button
                onClick={() => { setComparisonMode('labor'); saveSettings({ comparisonMode: 'labor' }); }}
                style={{
                  padding: '0.35rem 0.75rem', fontSize: '0.8rem',
                  background: comparisonMode === 'labor' ? '#8b5cf6' : '#f1f5f9',
                  color: comparisonMode === 'labor' ? '#fff' : '#64748b',
                  border: '1px solid #e2e8f0', borderRadius: '0 4px 4px 0', cursor: 'pointer',
                }}
              >
                Labor
              </button>
            </div>
          </div>

          {/* Revenue target (shown in revenue mode) */}
          {comparisonMode === 'revenue' && (
            <div>
              <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Monthly Revenue Target</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>$</span>
                <input
                  type="number"
                  value={capacityTarget / 1000000}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setCapacityTarget(val * 1000000);
                      saveSettings({ capacityTarget: val * 1000000 });
                    }
                  }}
                  step={0.5}
                  min={0}
                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '80px' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>M/month</span>
              </div>
            </div>
          )}

          {/* Labor targets (shown in labor mode) */}
          {comparisonMode === 'labor' && (
            <>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Headcount Target</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="number"
                    value={laborCapacityTarget}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1) {
                        setLaborCapacityTarget(val);
                        saveSettings({ laborCapacityTarget: val });
                      }
                    }}
                    min={1}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '70px' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>people</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Labor % of Value</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="number"
                    value={laborPctOfValue}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1 && val <= 100) {
                        setLaborPctOfValue(val);
                        saveSettings({ laborPctOfValue: val });
                      }
                    }}
                    min={1} max={100}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '55px' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>%</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Avg Labor Rate</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>$</span>
                  <input
                    type="number"
                    value={avgLaborRate}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1) {
                        setAvgLaborRate(val);
                        saveSettings({ avgLaborRate: val });
                      }
                    }}
                    min={1}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '60px' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>/hr</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Hrs/Person/Month</label>
                <input
                  type="number"
                  value={hoursPerPersonPerMonth}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 100 && val <= 220) {
                      setHoursPerPersonPerMonth(val);
                      saveSettings({ hoursPerPersonPerMonth: val });
                    }
                  }}
                  min={100} max={220}
                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '60px' }}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Horizon</label>
            <select
              value={horizonMonths}
              onChange={(e) => { const val = parseInt(e.target.value); setHorizonMonths(val); saveSettings({ horizonMonths: val }); }}
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            >
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
              <option value={36}>36 months</option>
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
            <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Market</label>
            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}
            >
              <option value="">All Markets</option>
              {marketOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Regional Targets (collapsible) */}
      <div className="card" style={{ padding: '0', marginBottom: '1rem', overflow: 'hidden' }}>
        <button
          onClick={() => setShowRegionTargets(!showRegionTargets)}
          style={{
            width: '100%', padding: '0.6rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#374151',
          }}
        >
          <span>Regional Targets (PDF Report)</span>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{showRegionTargets ? '\u25B2' : '\u25BC'}</span>
        </button>
        {showRegionTargets && (
          <div style={{ padding: '0 0.75rem 0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
              Set revenue and labor targets per region for the PDF report's regional comparison pages. Defaults to global target divided evenly.
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Region</th>
                  <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0' }}>Revenue Target ($/mo)</th>
                  <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0' }}>Labor Target (people)</th>
                </tr>
              </thead>
              <tbody>
                {REGIONS.map(r => {
                  const rt = regionTargets[r.prefix];
                  const defaultRevTarget = Math.round(capacityTarget / REGIONS.length);
                  const defaultLabTarget = Math.round(laborCapacityTarget / REGIONS.length);
                  return (
                    <tr key={r.prefix} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <span style={{
                          display: 'inline-block', width: '10px', height: '10px', background: r.color,
                          borderRadius: '2px', marginRight: '6px', verticalAlign: 'middle',
                        }} />
                        {r.label}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                          <span style={{ color: '#64748b' }}>$</span>
                          <input
                            type="number"
                            value={rt?.revenueTarget != null ? rt.revenueTarget / 1000000 : defaultRevTarget / 1000000}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                const updated = {
                                  ...regionTargets,
                                  [r.prefix]: {
                                    label: r.label,
                                    revenueTarget: val * 1000000,
                                    laborTarget: rt?.laborTarget ?? defaultLabTarget,
                                  },
                                };
                                setRegionTargets(updated);
                                saveSettings({ regionTargets: updated });
                              }
                            }}
                            step={0.1}
                            min={0}
                            style={{ padding: '0.3rem 0.4rem', fontSize: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '70px', textAlign: 'right' }}
                          />
                          <span style={{ color: '#64748b' }}>M</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                          <input
                            type="number"
                            value={rt?.laborTarget ?? defaultLabTarget}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val >= 0) {
                                const updated = {
                                  ...regionTargets,
                                  [r.prefix]: {
                                    label: r.label,
                                    revenueTarget: rt?.revenueTarget ?? defaultRevTarget,
                                    laborTarget: val,
                                  },
                                };
                                setRegionTargets(updated);
                                saveSettings({ regionTargets: updated });
                              }
                            }}
                            min={0}
                            style={{ padding: '0.3rem 0.4rem', fontSize: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '55px', textAlign: 'right' }}
                          />
                          <span style={{ color: '#64748b' }}>people</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>
          {comparisonMode === 'revenue' ? 'Revenue Projection vs. Capacity' : 'Labor Curve vs. Headcount Target'}
        </h3>
        <div style={{ height: '300px' }}>
          <Chart type="bar" data={chartData} options={chartOptions} />
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.5rem', fontSize: '0.7rem', color: '#64748b' }}>
          <span>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(59, 130, 246, 0.7)', border: '1px solid rgba(59, 130, 246, 0.9)', borderRadius: '2px', marginRight: '4px', verticalAlign: 'middle' }}></span>
            {comparisonMode === 'revenue' ? 'Project Backlog (committed)' : 'Project Labor (committed)'}
          </span>
          <span>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', background: 'rgba(34, 197, 94, 0.25)', border: '2px dashed rgba(34, 197, 94, 0.7)', borderRadius: '2px', marginRight: '4px', verticalAlign: 'middle' }}></span>
            {comparisonMode === 'revenue' ? 'Opportunity Pipeline (speculative)' : 'Opportunity Labor (speculative)'}
          </span>
          <span>
            <span style={{ display: 'inline-block', width: '12px', height: '2px', background: '#ef4444', borderRadius: '1px', marginRight: '4px', verticalAlign: 'middle' }}></span>
            {comparisonMode === 'revenue' ? 'Capacity Target' : 'Headcount Target'}
          </span>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="card" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.75rem 0' }}>Monthly Breakdown</h3>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Category</th>
                {monthKeys.map(m => (
                  <th key={m.key} style={{ padding: '0.4rem 0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', minWidth: '65px' }}>{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.4rem 0.5rem', fontWeight: 500, color: '#3b82f6' }}>
                  {comparisonMode === 'revenue' ? 'Project Backlog' : 'Project Labor'}
                </td>
                {monthKeys.map(m => (
                  <td key={m.key} style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                    {comparisonMode === 'revenue'
                      ? fmtCompact(projectMonthlyRevenue.get(m.key) || 0)
                      : fmtHeadcount(projectMonthlyLabor.get(m.key) || 0, hoursPerPersonPerMonth)
                    }
                  </td>
                ))}
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.4rem 0.5rem', fontWeight: 500, color: '#22c55e' }}>
                  {comparisonMode === 'revenue' ? 'Opp. Pipeline (wtd)' : 'Opp. Labor (est.)'}
                </td>
                {monthKeys.map(m => (
                  <td key={m.key} style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>
                    {comparisonMode === 'revenue'
                      ? fmtCompact(oppMonthlyTotals.get(m.key) || 0)
                      : fmtHeadcount(oppMonthlyLaborTotals.get(m.key) || 0, hoursPerPersonPerMonth)
                    }
                  </td>
                ))}
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>Combined</td>
                {monthKeys.map(m => {
                  const combined = (effectiveProjectMonthly.get(m.key) || 0) + (effectiveOppMonthly.get(m.key) || 0);
                  return (
                    <td key={m.key} style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>
                      {comparisonMode === 'revenue' ? fmtCompact(combined) : fmtHeadcount(combined, hoursPerPersonPerMonth)}
                    </td>
                  );
                })}
              </tr>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.4rem 0.5rem', fontWeight: 500, color: '#ef4444' }}>
                  {comparisonMode === 'revenue' ? 'Capacity Target' : 'Headcount Target'}
                </td>
                {monthKeys.map(m => (
                  <td key={m.key} style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#ef4444' }}>
                    {comparisonMode === 'revenue' ? fmtCompact(capacityTarget) : laborCapacityTarget.toString()}
                  </td>
                ))}
              </tr>
              <tr style={{ background: '#fef2f2' }}>
                <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, color: '#991b1b' }}>
                  Gap ({comparisonMode === 'revenue' ? 'backlog' : 'labor'} only)
                </td>
                {monthKeys.map(m => {
                  const projectValue = effectiveProjectMonthly.get(m.key) || 0;
                  const gap = effectiveTarget - projectValue;
                  return (
                    <td key={m.key} style={{
                      padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600,
                      color: gap > 0 ? '#dc2626' : '#16a34a',
                      background: gap > 0 ? '#fef2f2' : '#f0fdf4'
                    }}>
                      {gap > 0
                        ? (comparisonMode === 'revenue' ? fmtCompact(gap) : fmtHeadcount(gap, hoursPerPersonPerMonth))
                        : 'OK'
                      }
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Opportunity Fit Table */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
            Opportunity Fit Ranking
            <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '0.5rem' }}>
              ({opportunityScores.length} opportunities ranked by {comparisonMode === 'revenue' ? 'backlog' : 'labor'} fit)
            </span>
          </h3>
        </div>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', width: '30px' }}>#</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', minWidth: '200px' }}>Opportunity</th>
                <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', minWidth: '80px' }}>Value</th>
                <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', minWidth: '50px' }}>Prob</th>
                <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #e2e8f0', minWidth: '80px' }}>
                  {comparisonMode === 'revenue' ? 'Weighted' : 'Est. Hours'}
                </th>
                <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '80px' }}>Start</th>
                <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '50px' }}>Dur.</th>
                <th style={{ padding: '0.5rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', minWidth: '120px' }}>Fit Score</th>
              </tr>
            </thead>
            <tbody>
              {opportunityScores.map((s, idx) => (
                <tr
                  key={s.opportunity.id}
                  style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s' }}
                  onClick={() => navigate('/sales', { state: { selectedOpportunityId: s.opportunity.id } })}
                  onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>{idx + 1}</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>
                    <div style={{ fontWeight: 500 }}>{s.opportunity.title}</div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                      {s.opportunity.stage_name} | {s.opportunity.market || 'No market'} | {s.opportunity.assigned_to_name || 'Unassigned'}
                    </div>
                  </td>
                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>{fmtCompact(parseNum(s.opportunity.estimated_value))}</td>
                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#64748b' }}>{s.probability}%</td>
                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: '#64748b' }}>
                    {comparisonMode === 'revenue'
                      ? fmtCompact(s.weightedValue)
                      : fmtHoursCompact(s.weightedHours)
                    }
                  </td>
                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.7rem', color: '#64748b' }}>{format(s.projectedStart, 'MMM yy')}</td>
                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontSize: '0.7rem', color: '#64748b' }}>{s.workDuration}mo</td>
                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        flex: 1, height: '16px', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden', position: 'relative'
                      }}>
                        <div style={{
                          width: `${Math.min(100, s.fitScore)}%`, height: '100%',
                          background: getFitColor(s.fitScore), borderRadius: '8px', transition: 'width 0.3s'
                        }} />
                      </div>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600, color: getFitColor(s.fitScore),
                        background: getFitBg(s.fitScore), padding: '0.1rem 0.35rem', borderRadius: '4px',
                        minWidth: '30px', textAlign: 'center'
                      }}>
                        {s.fitScore.toFixed(0)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {opportunityScores.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                    No active opportunities to analyze
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: '1rem', fontSize: '0.7rem', color: '#64748b' }}>
        <strong>How fit scoring works:</strong> Each opportunity is scored 0-100 based on: how much of its
        {comparisonMode === 'revenue' ? ' revenue' : ' estimated labor'} lands in months with capacity gaps (60% weight),
        win probability (30% weight), and size appropriateness (10% weight).
        <span style={{ display: 'inline-block', background: '#dcfce7', color: '#16a34a', padding: '0 4px', borderRadius: '3px', margin: '0 4px' }}>60+</span> = strong fit,
        <span style={{ display: 'inline-block', background: '#fef9c3', color: '#ca8a04', padding: '0 4px', borderRadius: '3px', margin: '0 4px' }}>30-59</span> = moderate,
        <span style={{ display: 'inline-block', background: '#fee2e2', color: '#dc2626', padding: '0 4px', borderRadius: '3px', margin: '0 4px' }}>&lt;30</span> = weak fit.
        <br />
        {comparisonMode === 'revenue' ? (
          <><strong>Opportunity revenue</strong> is weighted by probability (stage-based or user override). Adjust the monthly target and horizon to refine the analysis.</>
        ) : (
          <><strong>Labor mode:</strong> Project labor uses actual remaining hours (Projected - JTD) from Vista data.
          Opportunity labor is estimated as {laborPctOfValue}% of estimated value (labor portion) &divide; ${avgLaborRate}/hr, then probability-weighted.
          Headcount = monthly hours &divide; {hoursPerPersonPerMonth} hrs/person/month.</>
        )}
      </div>
    </div>
  );
};

export default BacklogFitAnalysis;
