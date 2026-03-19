/**
 * Backlog Fit Calculator — server-side port of BacklogFitAnalysis.tsx calculation logic.
 * Computes project revenue/labor projections, opportunity fit scores, and strategy recommendations.
 */

// ─── Date Helpers (native JS, no date-fns) ───

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function differenceInMonths(a, b) {
  return (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
}

function formatMonthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(d) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function parseISO(str) {
  if (!str) return null;
  const d = new Date(str + (str.length <= 10 ? 'T12:00:00' : ''));
  return isNaN(d.getTime()) ? null : d;
}

function isBefore(a, b) {
  return a.getTime() < b.getTime();
}

// ─── Contour System (port of frontend/src/utils/contours.ts) ───

function getContourMultipliers(months, contour) {
  const multipliers = [];

  for (let i = 0; i < months; i++) {
    const position = months > 1 ? i / (months - 1) : 0.5;
    let weight;

    switch (contour) {
      case 'front':
        weight = 2 - position * 1.5;
        break;
      case 'back':
        weight = 0.5 + position * 1.5;
        break;
      case 'bell':
        weight = Math.exp(-Math.pow((position - 0.5) * 3, 2)) * 1.5 + 0.5;
        break;
      case 'turtle':
        weight = Math.exp(-Math.pow((position - 0.5) * 2, 2)) * 0.8 + 0.6;
        break;
      case 'double': {
        const peak1 = Math.exp(-Math.pow((position - 0.25) * 5, 2));
        const peak2 = Math.exp(-Math.pow((position - 0.75) * 5, 2));
        weight = (peak1 + peak2) * 0.8 + 0.4;
        break;
      }
      case 'early':
        weight = Math.exp(-Math.pow((position - 0.2) * 4, 2)) * 1.8 + 0.2;
        break;
      case 'late':
        weight = Math.exp(-Math.pow((position - 0.8) * 4, 2)) * 1.8 + 0.2;
        break;
      case 'scurve':
        weight = Math.exp(-Math.pow((position - 0.5) * 2.5, 2)) * 1.2 + 0.4;
        break;
      case 'rampup':
        weight = 0.1 + position * 1.9;
        break;
      case 'rampdown':
        weight = 2 - position * 1.9;
        break;
      case 'flat':
      default:
        weight = 1;
        break;
    }
    multipliers.push(weight);
  }

  const sum = multipliers.reduce((a, b) => a + b, 0);
  return multipliers.map(w => (w / sum) * months);
}

function getDefaultContour(pctComplete) {
  if (pctComplete < 15) return 'scurve';
  if (pctComplete < 40) return 'bell';
  if (pctComplete < 70) return 'back';
  if (pctComplete < 90) return 'rampdown';
  return 'flat';
}

// ─── Duration Rules ───

const projectDurationRules = [
  { minValue: 0, maxValue: 500000, months: 3 },
  { minValue: 500000, maxValue: 2000000, months: 6 },
  { minValue: 2000000, maxValue: 5000000, months: 8 },
  { minValue: 5000000, maxValue: 10000000, months: 12 },
  { minValue: 10000000, maxValue: Infinity, months: 24 },
];

const pursuitRules = [
  { minValue: 0, maxValue: 500000, months: 2 },
  { minValue: 500000, maxValue: 2000000, months: 4 },
  { minValue: 2000000, maxValue: 5000000, months: 6 },
  { minValue: 5000000, maxValue: 10000000, months: 9 },
  { minValue: 10000000, maxValue: Infinity, months: 12 },
];

const workDurationRules = [
  { minValue: 0, maxValue: 500000, months: 3 },
  { minValue: 500000, maxValue: 2000000, months: 6 },
  { minValue: 2000000, maxValue: 5000000, months: 8 },
  { minValue: 5000000, maxValue: 10000000, months: 12 },
  { minValue: 10000000, maxValue: Infinity, months: 24 },
];

function getDurationForValue(value, rules) {
  for (const rule of rules) {
    if (value >= rule.minValue && value < rule.maxValue) return rule.months;
  }
  return 24;
}

// ─── Helpers ───

function parseNum(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

function generateMonthKeys(horizonMonths) {
  const now = startOfMonth(new Date());
  return Array.from({ length: horizonMonths }, (_, i) => {
    const d = addMonths(now, i);
    return { key: formatMonthKey(d), label: formatMonthLabel(d) };
  });
}

// ─── Formatting helpers for strategy text ───

function fmtCurrency(value) {
  if (value === null || value === undefined || value === 0) return '$0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtHeadcount(hours, hpp) {
  if (hours === 0 || isNaN(hours)) return '0';
  return (hours / hpp).toFixed(1);
}

// ─── Core Calculations ───

const EXCLUDED_STAGES = new Set(['Won', 'Lost', 'Passed', 'Awarded']);

// ─── Region Definitions ───

const REGIONS = [
  { prefix: '10', label: 'NE Wisconsin', color: '#3b82f6' },
  { prefix: '20', label: 'Central WI', color: '#8b5cf6' },
  { prefix: '30', label: 'Western WI', color: '#f59e0b' },
  { prefix: '40', label: 'Tempe, AZ', color: '#ef4444' },
];

function calcProjectMonthlyRevenue(contracts, stateFilter, regionFilter) {
  const monthly = new Map();
  if (!contracts) return monthly;
  const now = startOfMonth(new Date());

  for (const c of contracts) {
    const status = (c.status || '').toLowerCase();
    if (!status.includes('open') && !status.includes('soft')) continue;
    if (stateFilter && (c.ship_state || '').trim() !== stateFilter) continue;
    if (regionFilter && !(c.linked_department_number || '').startsWith(regionFilter + '-')) continue;

    const backlog = parseNum(c.backlog);
    if (backlog <= 0) continue;

    const earnedRevenue = parseNum(c.earned_revenue);
    const projectedRevenue = parseNum(c.projected_revenue);
    const contractValue = parseNum(c.contract_amount) || projectedRevenue;

    let remainingMonths;
    if (c.user_adjusted_end_months != null) {
      remainingMonths = Math.max(1, Math.min(36, c.user_adjusted_end_months));
    } else {
      const totalDuration = getDurationForValue(contractValue, projectDurationRules);
      const pctComplete = projectedRevenue > 0 ? earnedRevenue / projectedRevenue : 0;
      remainingMonths = Math.max(1, Math.min(36, Math.ceil(totalDuration * (1 - pctComplete))));
    }

    const pctComplete = projectedRevenue > 0 ? (earnedRevenue / projectedRevenue) * 100 : 0;
    const contour = c.user_selected_contour || getDefaultContour(pctComplete);
    const multipliers = getContourMultipliers(remainingMonths, contour);
    const baseMonthly = backlog / remainingMonths;

    for (let i = 0; i < remainingMonths; i++) {
      const monthDate = addMonths(now, i);
      const monthKey = formatMonthKey(monthDate);
      const monthRevenue = baseMonthly * multipliers[i];
      monthly.set(monthKey, (monthly.get(monthKey) || 0) + monthRevenue);
    }
  }

  return monthly;
}

function calcProjectMonthlyLabor(contracts, stateFilter, regionFilter) {
  const monthly = new Map();
  if (!contracts) return monthly;
  const now = startOfMonth(new Date());

  for (const c of contracts) {
    const status = (c.status || '').toLowerCase();
    if (!status.includes('open') && !status.includes('soft')) continue;
    if (stateFilter && (c.ship_state || '').trim() !== stateFilter) continue;
    if (regionFilter && !(c.linked_department_number || '').startsWith(regionFilter + '-')) continue;

    const pfRemaining = Math.max(0, (parseNum(c.pf_hours_projected) || parseNum(c.pf_hours_estimate)) - parseNum(c.pf_hours_jtd));
    const smRemaining = Math.max(0, (parseNum(c.sm_hours_projected) || parseNum(c.sm_hours_estimate)) - parseNum(c.sm_hours_jtd));
    const plRemaining = Math.max(0, (parseNum(c.pl_hours_projected) || parseNum(c.pl_hours_estimate)) - parseNum(c.pl_hours_jtd));
    const totalRemainingHours = pfRemaining + smRemaining + plRemaining;

    if (totalRemainingHours <= 0) continue;

    const earnedRevenue = parseNum(c.earned_revenue);
    const projectedRevenue = parseNum(c.projected_revenue);
    const contractValue = parseNum(c.contract_amount) || projectedRevenue;
    const backlog = parseNum(c.backlog);

    let remainingMonths;
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
    const contour = c.user_selected_contour || getDefaultContour(pctComplete);
    const multipliers = getContourMultipliers(remainingMonths, contour);
    const baseMonthly = totalRemainingHours / remainingMonths;

    for (let i = 0; i < remainingMonths; i++) {
      const monthDate = addMonths(now, i);
      const monthKey = formatMonthKey(monthDate);
      const monthHours = baseMonthly * multipliers[i];
      monthly.set(monthKey, (monthly.get(monthKey) || 0) + monthHours);
    }
  }

  return monthly;
}

function calcOpportunityScores(opportunities, projectMonthlyRevenue, projectMonthlyLabor, monthKeys, settings, mode) {
  const now = startOfMonth(new Date());
  const results = [];

  const effectiveProjectMonthly = mode === 'revenue' ? projectMonthlyRevenue : projectMonthlyLabor;
  const effectiveTarget = mode === 'revenue'
    ? settings.capacityTarget
    : settings.laborCapacityTarget * settings.hoursPerPersonPerMonth;

  // Calculate monthly gaps
  const monthlyGaps = new Map();
  for (const { key } of monthKeys) {
    const projectValue = effectiveProjectMonthly.get(key) || 0;
    const gap = Math.max(0, effectiveTarget - projectValue);
    monthlyGaps.set(key, gap);
  }
  const totalGapAcrossMonths = Array.from(monthlyGaps.values()).reduce((s, v) => s + v, 0);

  const qualitativeProbMap = { 'High': 75, 'Medium': 50, 'Low': 25 };

  for (const opp of opportunities) {
    const estimatedValue = parseNum(opp.estimated_value);
    const probability = opp.probability && qualitativeProbMap[opp.probability]
      ? qualitativeProbMap[opp.probability]
      : parseNum(opp.stage_probability);
    const weightedValue = estimatedValue * (probability / 100);

    const laborValue = estimatedValue * (settings.laborPctOfValue / 100);
    const estimatedHours = laborValue / settings.avgLaborRate;
    const weightedHours = estimatedHours * (probability / 100);

    // Determine start date
    let projectedStart;
    const parsedUserStart = parseISO(opp.user_adjusted_start_date);
    const parsedEstStart = parseISO(opp.estimated_start_date);

    if (parsedUserStart) {
      projectedStart = startOfMonth(parsedUserStart);
    } else if (parsedEstStart && !isBefore(parsedEstStart, now)) {
      projectedStart = startOfMonth(parsedEstStart);
    } else {
      const pursuitMonths = getDurationForValue(estimatedValue, pursuitRules);
      projectedStart = addMonths(now, pursuitMonths);
    }

    // Determine duration
    let workDuration;
    if (opp.user_adjusted_duration_months != null) {
      workDuration = opp.user_adjusted_duration_months;
    } else if (opp.estimated_duration_days) {
      workDuration = Math.max(1, Math.round(parseNum(opp.estimated_duration_days) / 30));
    } else {
      workDuration = getDurationForValue(estimatedValue, workDurationRules);
    }
    workDuration = Math.max(1, Math.min(36, workDuration));

    // Distribute across months
    const contour = opp.contour_type || 'scurve';
    const multipliers = getContourMultipliers(workDuration, contour);
    const baseMonthlyRevenue = weightedValue / workDuration;
    const baseMonthlyLabor = weightedHours / workDuration;
    const monthsUntilStart = Math.max(0, differenceInMonths(projectedStart, now));

    const monthlyRevenue = new Map();
    const monthlyLabor = new Map();
    let effectiveInGapMonths = 0;
    let totalEffective = 0;

    for (let i = 0; i < workDuration; i++) {
      const monthDate = addMonths(now, monthsUntilStart + i);
      const monthKey = formatMonthKey(monthDate);

      const monthRevenue = baseMonthlyRevenue * multipliers[i];
      const monthLabor = baseMonthlyLabor * multipliers[i];

      monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + monthRevenue);
      monthlyLabor.set(monthKey, (monthlyLabor.get(monthKey) || 0) + monthLabor);

      const monthEffective = mode === 'revenue' ? monthRevenue : monthLabor;
      totalEffective += monthEffective;

      const gap = monthlyGaps.get(monthKey) || 0;
      if (gap > 0) {
        effectiveInGapMonths += Math.min(monthEffective, gap);
      }
    }

    // Calculate fit score (0-100)
    const gapFillScore = totalEffective > 0 ? (effectiveInGapMonths / totalEffective) * 100 : 0;
    const probScore = probability;
    const effectiveWeighted = mode === 'revenue' ? weightedValue : weightedHours;
    const sizeFit = totalGapAcrossMonths > 0
      ? Math.min(100, (1 - Math.abs(effectiveWeighted - totalGapAcrossMonths / opportunities.length) / totalGapAcrossMonths) * 100)
      : 50;

    const fitScore = Math.max(0, Math.min(100,
      (gapFillScore * 0.6) + (probScore * 0.3) + (Math.max(0, sizeFit) * 0.1)
    ));

    results.push({
      opportunity: opp,
      projectedStart,
      projectedStartLabel: formatMonthLabel(projectedStart),
      workDuration,
      probability,
      weightedValue,
      weightedHours,
      monthlyRevenue,
      monthlyLabor,
      fitScore,
      gapFillPercent: totalGapAcrossMonths > 0 ? (effectiveInGapMonths / totalGapAcrossMonths) * 100 : 0,
    });
  }

  results.sort((a, b) => b.fitScore - a.fitScore);
  return results;
}

function aggregateOppMonthly(scores, mode) {
  const totals = new Map();
  for (const s of scores) {
    const map = mode === 'revenue' ? s.monthlyRevenue : s.monthlyLabor;
    map.forEach((value, key) => {
      totals.set(key, (totals.get(key) || 0) + value);
    });
  }
  return totals;
}

function calcSummaryStats(monthKeys, projectMonthly, oppMonthly, target, horizonMonths) {
  const gapMonths = monthKeys.filter(m => {
    const projectValue = projectMonthly.get(m.key) || 0;
    return projectValue < target;
  }).length;

  const totalProjectValue = monthKeys.reduce((sum, m) => sum + (projectMonthly.get(m.key) || 0), 0);
  const totalOppValue = monthKeys.reduce((sum, m) => sum + (oppMonthly.get(m.key) || 0), 0);
  const totalCapacity = target * horizonMonths;
  const totalGap = Math.max(0, totalCapacity - totalProjectValue);

  return { gapMonths, totalProjectValue, totalOppValue, totalCapacity, totalGap };
}

// ─── Regional Analysis ───

function buildRegionalAnalysis(contracts, filteredOpps, horizonMonths, settings) {
  const monthKeys = generateMonthKeys(horizonMonths);
  const regionCount = REGIONS.length;

  return REGIONS.map(region => {
    const regionSettings = settings.regionTargets?.[region.prefix];
    const revTarget = regionSettings?.revenueTarget || Math.round(settings.capacityTarget / regionCount);
    const labTargetPeople = regionSettings?.laborTarget || Math.round(settings.laborCapacityTarget / regionCount);
    const labTarget = labTargetPeople * settings.hoursPerPersonPerMonth;

    const projectRevenue = calcProjectMonthlyRevenue(contracts, null, region.prefix);
    const projectLabor = calcProjectMonthlyLabor(contracts, null, region.prefix);

    // Create region-specific settings for scoring
    const regionScoringSettings = { ...settings, capacityTarget: revTarget, laborCapacityTarget: labTargetPeople };

    const revenueScores = calcOpportunityScores(filteredOpps, projectRevenue, projectLabor, monthKeys, regionScoringSettings, 'revenue');
    const revenueOppMonthly = aggregateOppMonthly(revenueScores, 'revenue');
    const revenueSummary = calcSummaryStats(monthKeys, projectRevenue, revenueOppMonthly, revTarget, horizonMonths);

    const laborScores = calcOpportunityScores(filteredOpps, projectRevenue, projectLabor, monthKeys, regionScoringSettings, 'labor');
    const laborOppMonthly = aggregateOppMonthly(laborScores, 'labor');
    const laborSummary = calcSummaryStats(monthKeys, projectLabor, laborOppMonthly, labTarget, horizonMonths);

    return {
      ...region,
      monthKeys,
      revTarget,
      labTargetPeople,
      revenue: { projectMonthly: projectRevenue, oppMonthly: revenueOppMonthly, summary: revenueSummary, scores: revenueScores.slice(0, 5) },
      labor: { projectMonthly: projectLabor, oppMonthly: laborOppMonthly, summary: laborSummary, scores: laborScores.slice(0, 5) },
    };
  });
}

// ─── Master Report Builder ───

function buildBacklogFitReport(contracts, opportunities, settings) {
  const filteredOpps = (opportunities || []).filter(o => {
    if (o.stage_name && EXCLUDED_STAGES.has(o.stage_name)) return false;
    if (!o.estimated_value || parseNum(o.estimated_value) <= 0) return false;
    return true;
  });

  const variants = [
    { label: 'All States \u2014 12 Months', stateFilter: null, horizonMonths: 12 },
    { label: 'All States \u2014 18 Months', stateFilter: null, horizonMonths: 18 },
    { label: 'Wisconsin \u2014 12 Months', stateFilter: 'WI', horizonMonths: 12 },
    { label: 'Wisconsin \u2014 18 Months', stateFilter: 'WI', horizonMonths: 18 },
  ];

  const results = variants.map(v => {
    const monthKeys = generateMonthKeys(v.horizonMonths);
    const projectRevenue = calcProjectMonthlyRevenue(contracts, v.stateFilter);
    const projectLabor = calcProjectMonthlyLabor(contracts, v.stateFilter);

    // Revenue mode
    const revenueScores = calcOpportunityScores(filteredOpps, projectRevenue, projectLabor, monthKeys, settings, 'revenue');
    const revenueOppMonthly = aggregateOppMonthly(revenueScores, 'revenue');
    const revenueSummary = calcSummaryStats(monthKeys, projectRevenue, revenueOppMonthly, settings.capacityTarget, v.horizonMonths);

    // Labor mode
    const laborTarget = settings.laborCapacityTarget * settings.hoursPerPersonPerMonth;
    const laborScores = calcOpportunityScores(filteredOpps, projectRevenue, projectLabor, monthKeys, settings, 'labor');
    const laborOppMonthly = aggregateOppMonthly(laborScores, 'labor');
    const laborSummary = calcSummaryStats(monthKeys, projectLabor, laborOppMonthly, laborTarget, v.horizonMonths);

    return {
      ...v,
      monthKeys,
      revenue: { projectMonthly: projectRevenue, oppMonthly: revenueOppMonthly, summary: revenueSummary, scores: revenueScores.slice(0, 10) },
      labor: { projectMonthly: projectLabor, oppMonthly: laborOppMonthly, summary: laborSummary, scores: laborScores.slice(0, 10) },
    };
  });

  // Regional analysis for 12mo and 18mo
  const regional12 = buildRegionalAnalysis(contracts, filteredOpps, 12, settings);
  const regional18 = buildRegionalAnalysis(contracts, filteredOpps, 18, settings);

  return { variants: results, regional12, regional18, settings };
}

// ─── Strategy Recommendations ───

function generateStrategyRecommendations(variants, settings, regional12) {
  const recs = [];
  const hpp = settings.hoursPerPersonPerMonth;

  const as12 = variants[0]; // All States / 12mo
  const as18 = variants[1]; // All States / 18mo
  const wi12 = variants[2]; // Wisconsin / 12mo
  const wi18 = variants[3]; // Wisconsin / 18mo

  // 1. Overall Capacity Posture
  const revCoverage = as12.revenue.summary.totalCapacity > 0
    ? (as12.revenue.summary.totalProjectValue / as12.revenue.summary.totalCapacity) * 100 : 0;
  const labCoverage = as12.labor.summary.totalCapacity > 0
    ? (as12.labor.summary.totalProjectValue / as12.labor.summary.totalCapacity) * 100 : 0;

  let posture;
  if (revCoverage >= 90) posture = 'The pipeline is healthy; focus on selective, high-margin pursuits.';
  else if (revCoverage >= 70) posture = 'Moderate new work is needed to close remaining gaps.';
  else posture = 'Significant new work is needed to fill the pipeline.';

  recs.push({
    type: revCoverage >= 80 ? 'info' : revCoverage >= 60 ? 'warning' : 'critical',
    title: 'Overall Capacity Posture (12-Month)',
    body: `Committed backlog covers ${revCoverage.toFixed(0)}% of the 12-month revenue target (${fmtCurrency(as12.revenue.summary.totalProjectValue)} of ${fmtCurrency(as12.revenue.summary.totalCapacity)}) and ${labCoverage.toFixed(0)}% of the labor target. ${posture}`,
  });

  // 2. Near-Term vs Long-Term Gap
  const nearMonths = as12.monthKeys.slice(0, 6);
  const farMonths = as12.monthKeys.slice(6);
  const nearGap = nearMonths.reduce((s, m) => s + Math.max(0, settings.capacityTarget - (as12.revenue.projectMonthly.get(m.key) || 0)), 0);
  const farGap = farMonths.reduce((s, m) => s + Math.max(0, settings.capacityTarget - (as12.revenue.projectMonthly.get(m.key) || 0)), 0);

  if (nearGap > 0 && nearGap > farGap * 1.5) {
    recs.push({
      type: 'critical',
      title: 'Near-Term Revenue Urgency',
      body: `The next 6 months show a ${fmtCurrency(nearGap)} revenue gap, significantly larger than the ${fmtCurrency(farGap)} gap in months 7\u201312. Prioritize fast-start opportunities with short pursuit cycles and early work contours.`,
    });
  } else if (farGap > 0 && farGap > nearGap * 1.5) {
    recs.push({
      type: 'warning',
      title: 'Long-Range Pipeline Gap',
      body: `Months 7\u201312 show a larger gap (${fmtCurrency(farGap)}) than near-term (${fmtCurrency(nearGap)}). Begin pursuit of larger, longer-lead opportunities now to fill future capacity.`,
    });
  } else if (nearGap > 0 || farGap > 0) {
    recs.push({
      type: 'info',
      title: 'Gap Distribution',
      body: `Revenue gaps are relatively evenly spread: ${fmtCurrency(nearGap)} in months 1\u20136 and ${fmtCurrency(farGap)} in months 7\u201312. A balanced pursuit approach across timelines is appropriate.`,
    });
  }

  // 3. Wisconsin vs All-States
  const wiRevTotal = wi12.revenue.summary.totalProjectValue;
  const allRevTotal = as12.revenue.summary.totalProjectValue;
  const wiRevShare = allRevTotal > 0 ? (wiRevTotal / allRevTotal) * 100 : 0;
  const wiGapTotal = wi12.revenue.summary.totalGap;
  const allGapTotal = as12.revenue.summary.totalGap;
  const wiGapShare = allGapTotal > 0 ? (wiGapTotal / allGapTotal) * 100 : 0;

  let wiInsight;
  if (wiGapShare > wiRevShare + 10) {
    wiInsight = 'Wisconsin has disproportionately larger gaps \u2014 consider increasing local pursuit efforts and bid activity.';
  } else if (wiGapShare < wiRevShare - 10) {
    wiInsight = 'Wisconsin backlog is proportionally stronger than other states \u2014 opportunities in other geographies should be prioritized to balance the portfolio.';
  } else {
    wiInsight = 'Wisconsin gaps are roughly proportional to its share of the backlog.';
  }

  recs.push({
    type: 'info',
    title: 'Wisconsin Market Position',
    body: `Wisconsin represents ${wiRevShare.toFixed(0)}% of committed revenue (${fmtCurrency(wiRevTotal)}) and ${wiGapShare.toFixed(0)}% of the total gap. ${wiInsight}`,
  });

  // 4. 18-Month Outlook
  const rev18Coverage = as18.revenue.summary.totalCapacity > 0
    ? (as18.revenue.summary.totalProjectValue / as18.revenue.summary.totalCapacity) * 100 : 0;

  if (rev18Coverage < revCoverage - 15) {
    recs.push({
      type: 'warning',
      title: '18-Month Outlook Weakens',
      body: `The 18-month revenue coverage (${rev18Coverage.toFixed(0)}%) drops significantly from the 12-month view (${revCoverage.toFixed(0)}%). Backlog thins considerably in the second half of the horizon. Begin cultivating larger, longer-duration opportunities.`,
    });
  }

  // 5. Top Opportunity Targets
  const top5 = as12.revenue.scores.slice(0, 5);
  if (top5.length > 0) {
    const targetList = top5.map((s, i) =>
      `${i + 1}. ${s.opportunity.title} \u2014 ${fmtCurrency(s.weightedValue)} weighted value, ${s.fitScore.toFixed(0)} fit score, starts ${s.projectedStartLabel}${s.opportunity.market ? ` (${s.opportunity.market})` : ''}`
    ).join('\n');
    recs.push({
      type: 'info',
      title: 'Priority Pursuit Targets',
      body: `Based on gap-fill alignment, win probability, and size fit:\n${targetList}`,
    });
  }

  // 6. Revenue vs Labor Mismatch
  const revGapPct = as12.revenue.summary.totalCapacity > 0
    ? (as12.revenue.summary.totalGap / as12.revenue.summary.totalCapacity) * 100 : 0;
  const labGapPct = as12.labor.summary.totalCapacity > 0
    ? (as12.labor.summary.totalGap / as12.labor.summary.totalCapacity) * 100 : 0;

  if (Math.abs(revGapPct - labGapPct) > 15) {
    recs.push({
      type: 'warning',
      title: 'Revenue / Labor Mismatch',
      body: revGapPct > labGapPct
        ? `Revenue gap (${revGapPct.toFixed(0)}% of target) exceeds the labor gap (${labGapPct.toFixed(0)}%). Current work is labor-heavy with lower revenue per person-hour. Focus on higher-value opportunities to improve revenue density.`
        : `Labor gap (${labGapPct.toFixed(0)}% of target) exceeds the revenue gap (${revGapPct.toFixed(0)}%). Pipeline contains material/subcontract-heavy work with less self-performed labor. If maintaining headcount is a priority, pursue labor-intensive opportunities.`,
    });
  }

  // 7. Critical Gap Months
  const monthGaps = as12.monthKeys.map(m => ({
    label: m.label,
    revGap: Math.max(0, settings.capacityTarget - (as12.revenue.projectMonthly.get(m.key) || 0)),
  })).sort((a, b) => b.revGap - a.revGap);

  const worstMonths = monthGaps.slice(0, 3).filter(m => m.revGap > 0);
  if (worstMonths.length > 0) {
    recs.push({
      type: 'warning',
      title: 'Critical Gap Months',
      body: `Largest revenue gaps: ${worstMonths.map(m => `${m.label} (${fmtCurrency(m.revGap)})`).join(', ')}. Target opportunities whose projected start dates and work durations overlap these periods for maximum impact.`,
    });
  }

  // 8. Regional Analysis
  if (regional12 && regional12.length > 0) {
    // Find regions with largest proportional gap
    const regionGaps = regional12.map(r => {
      const revCap = r.revenue.summary.totalCapacity || 1;
      const revGapPctR = (r.revenue.summary.totalGap / revCap) * 100;
      return { label: r.label, prefix: r.prefix, revGapPct: revGapPctR, gap: r.revenue.summary.totalGap, committed: r.revenue.summary.totalProjectValue };
    }).sort((a, b) => b.revGapPct - a.revGapPct);

    const worstRegion = regionGaps[0];
    const bestRegion = regionGaps[regionGaps.length - 1];

    if (worstRegion && worstRegion.revGapPct > 20) {
      const regionSummary = regionGaps.map(r =>
        `${r.label}: ${fmtCurrency(r.committed)} committed, ${r.revGapPct.toFixed(0)}% gap`
      ).join('; ');

      recs.push({
        type: worstRegion.revGapPct > 50 ? 'critical' : 'warning',
        title: 'Regional Capacity Imbalance',
        body: `${worstRegion.label} has the largest capacity gap at ${worstRegion.revGapPct.toFixed(0)}% (${fmtCurrency(worstRegion.gap)}), while ${bestRegion.label} is at ${bestRegion.revGapPct.toFixed(0)}%. Regional breakdown: ${regionSummary}.`,
      });
    }

    // Check for regions with no committed work
    const emptyRegions = regionGaps.filter(r => r.committed === 0);
    if (emptyRegions.length > 0 && emptyRegions.length < regionGaps.length) {
      recs.push({
        type: 'warning',
        title: 'Regions Without Committed Work',
        body: `${emptyRegions.map(r => r.label).join(', ')} ${emptyRegions.length === 1 ? 'has' : 'have'} no committed backlog in the 12-month horizon. Consider whether these regions need targeted business development or if workload can be redirected from busier regions.`,
      });
    }
  }

  return recs;
}

module.exports = {
  buildBacklogFitReport,
  generateStrategyRecommendations,
  REGIONS,
  // Exported for formatting in HTML generator
  fmtCurrency,
  fmtHeadcount,
  parseNum,
  formatMonthLabel,
  // Default duration rules (used as fallback when tenant has no custom rules)
  pursuitRules,
  workDurationRules,
};
