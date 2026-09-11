/**
 * Backlog Analysis Calculator
 * Computes FY-split backlog burn, GM on backlog, SG&A coverage,
 * and pipeline totals (Awarded Not in Vista, High Probability).
 */

const { LOCATION_GROUPS } = require('../constants/locationGroups');

// ─── Date helpers ───────────────────────────────────────────────

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

function parseISO(str) {
  if (!str) return null;
  const d = new Date(str + (str.length <= 10 ? 'T12:00:00' : ''));
  return isNaN(d.getTime()) ? null : d;
}

function parseNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return isNaN(n) ? 0 : n;
}

// ─── Contour distribution ───────────────────────────────────────

function getContourMultipliers(months, contour) {
  const multipliers = [];
  for (let i = 0; i < months; i++) {
    const pos = months > 1 ? i / (months - 1) : 0.5;
    let w;
    switch (contour) {
      case 'front':    w = 2 - pos * 1.5; break;
      case 'back':     w = 0.5 + pos * 1.5; break;
      case 'bell':     w = Math.exp(-Math.pow((pos - 0.5) * 3, 2)) * 1.5 + 0.5; break;
      case 'turtle':   w = Math.exp(-Math.pow((pos - 0.5) * 2, 2)) * 0.8 + 0.6; break;
      case 'double': {
        const p1 = Math.exp(-Math.pow((pos - 0.25) * 5, 2));
        const p2 = Math.exp(-Math.pow((pos - 0.75) * 5, 2));
        w = (p1 + p2) * 0.8 + 0.4; break;
      }
      case 'early':    w = Math.exp(-Math.pow((pos - 0.2) * 4, 2)) * 1.8 + 0.2; break;
      case 'late':     w = Math.exp(-Math.pow((pos - 0.8) * 4, 2)) * 1.8 + 0.2; break;
      case 'scurve':   w = Math.exp(-Math.pow((pos - 0.5) * 2.5, 2)) * 1.2 + 0.4; break;
      case 'rampup':   w = 0.1 + pos * 1.9; break;
      case 'rampdown': w = 2 - pos * 1.9; break;
      case 'gradual':  w = Math.pow(Math.sin(pos * Math.PI), 2) * 1.5 + 0.2; break;
      default:         w = 1; break;
    }
    multipliers.push(w);
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

// ─── Duration rules (mirror backlogFitCalculator) ───────────────

const PROJECT_DURATION_RULES = [
  { min: 0,         max: 500000,    months: 3 },
  { min: 500000,    max: 2000000,   months: 6 },
  { min: 2000000,   max: 5000000,   months: 8 },
  { min: 5000000,   max: 10000000,  months: 12 },
  { min: 10000000,  max: Infinity,  months: 24 },
];

function getDuration(value) {
  for (const r of PROJECT_DURATION_RULES) {
    if (value >= r.min && value < r.max) return r.months;
  }
  return 24;
}

// ─── Location group helper ──────────────────────────────────────

function getDivisionForContract(c) {
  const deptCode = c.department_code || c.linked_department_number || '';
  const prefix = deptCode.substring(0, 2);
  const grp = LOCATION_GROUPS.find(g => g.prefix === prefix);
  return grp ? grp.value : null;
}

// ─── Main calculation ───────────────────────────────────────────

/**
 * Build the Backlog Analysis metrics.
 *
 * @param {Array}  contracts       - rows from vp_contracts (getAllContracts)
 * @param {Array}  opportunities   - rows from opportunities model
 * @param {Object} settings          - { monthlySgAndA, divisionFilter, teamMemberNames }
 *   teamMemberNames: Set<string> of lowercased "first last" names for the selected team,
 *                    or null/undefined for "all teams".
 *                    Vista stores PMs as "Last, First" — pmInTeam() handles the reversal.
 * @returns {Object} metrics
 */

function pmInTeam(pmName, teamMemberNames) {
  if (!pmName || !teamMemberNames || teamMemberNames.size === 0) return false;
  const pm = pmName.toLowerCase();
  for (const name of teamMemberNames) {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      const reversed = `${parts[parts.length - 1]}, ${parts[0]}`;
      if (pm.startsWith(reversed)) return true;
    }
    if (pm === name) return true;
  }
  return false;
}

function buildBacklogAnalysis(contracts, opportunities, settings = {}) {
  const {
    monthlySgAndA, sgaMode, sgaPct,
    scenario, conservativePct, aggressivePct,
    divisionFilter, teamMemberNames, gmOverrideMap,
  } = settings;

  const now = startOfMonth(new Date());
  const currentYear = now.getFullYear();

  // Accumulators
  let currentFYRevenue = 0;
  let futureFYRevenue  = 0;
  let currentFYGM      = 0;
  let futureFYGM       = 0;

  const divNames = new Set();
  const contractDetails = [];

  for (const c of contracts) {
    const status = (c.status || '').toLowerCase();
    if (!status.includes('open') && !status.includes('soft')) continue;

    const backlog = parseNum(c.backlog) + parseNum(c.ipd_amount);
    if (backlog <= 0) continue;

    const division = getDivisionForContract(c);
    if (division) divNames.add(division);

    // Apply filters
    if (divisionFilter && divisionFilter !== 'all' && division !== divisionFilter) continue;
    if (teamMemberNames && teamMemberNames.size > 0) {
      if (!pmInTeam(c.project_manager_name, teamMemberNames)) continue;
    }

    let gm = parseNum(c.gross_profit_percent); // decimal (0.15 = 15%)
    if (gmOverrideMap && (gm >= 0.995 || gm === 0) && gmOverrideMap[c.id] != null) {
      gm = gmOverrideMap[c.id];
    }

    const earned    = parseNum(c.earned_revenue);
    const projected = parseNum(c.projected_revenue);
    const value     = parseNum(c.contract_amount) || projected;

    // Remaining months from schedule
    let remainingMonths;
    const endDate = parseISO(
      c.user_adjusted_end_date
        ? (typeof c.user_adjusted_end_date === 'string' ? c.user_adjusted_end_date.slice(0, 10) : null)
        : null
    );
    if (endDate) {
      const off = differenceInMonths(startOfMonth(endDate), now);
      remainingMonths = Math.max(1, Math.min(36, off));
    } else {
      const totalDur = getDuration(value);
      const pct = projected > 0 ? earned / projected : 0;
      remainingMonths = Math.max(1, Math.min(36, Math.ceil(totalDur * (1 - pct))));
    }

    const pctComplete = projected > 0 ? (earned / projected) * 100 : 0;
    const contour     = c.user_selected_contour || getDefaultContour(pctComplete);
    const multipliers = getContourMultipliers(remainingMonths, contour);
    const baseMonthly = backlog / remainingMonths;

    let contractCurrentFY = 0;
    let contractFutureFY  = 0;

    // Distribute backlog across months
    for (let i = 0; i < remainingMonths; i++) {
      const monthDate = addMonths(now, i);
      const rev = baseMonthly * multipliers[i];

      if (monthDate.getFullYear() === currentYear) {
        currentFYRevenue  += rev;
        currentFYGM       += rev * gm;
        contractCurrentFY += rev;
      } else {
        futureFYRevenue  += rev;
        futureFYGM       += rev * gm;
        contractFutureFY += rev;
      }
    }

    contractDetails.push({
      contractNumber:   c.contract_number || '',
      description:      c.description || '',
      customerName:     c.customer_name || '',
      pmName:           c.linked_employee_name || c.project_manager_name || '',
      division:         division || '',
      totalBacklog:     backlog,
      currentFYRevenue: contractCurrentFY,
      futureFYRevenue:  contractFutureFY,
      gmPct:            gm * 100,
      currentFYGM:      contractCurrentFY * gm,
      futureFYGM:       contractFutureFY  * gm,
      totalGM:          backlog * gm,
      pctComplete:      Math.round(pctComplete),
    });
  }

  // Sort by total backlog descending
  contractDetails.sort((a, b) => b.totalBacklog - a.totalBacklog);

  // ─── Scenario multiplier ────────────────────────────────────
  let scenarioMultiplier = 1;
  if (scenario === 'conservative' && conservativePct > 0) {
    scenarioMultiplier = 1 - conservativePct / 100;
  } else if (scenario === 'aggressive' && aggressivePct > 0) {
    scenarioMultiplier = 1 + aggressivePct / 100;
  }

  if (scenarioMultiplier !== 1) {
    currentFYRevenue *= scenarioMultiplier;
    futureFYRevenue  *= scenarioMultiplier;
    currentFYGM      *= scenarioMultiplier;
    futureFYGM       *= scenarioMultiplier;
    for (const c of contractDetails) {
      c.totalBacklog     *= scenarioMultiplier;
      c.currentFYRevenue *= scenarioMultiplier;
      c.futureFYRevenue  *= scenarioMultiplier;
      c.currentFYGM      *= scenarioMultiplier;
      c.futureFYGM       *= scenarioMultiplier;
      c.totalGM          *= scenarioMultiplier;
    }
  }

  const totalBacklogRevenue = currentFYRevenue + futureFYRevenue;
  const totalBacklogGM      = currentFYGM + futureFYGM;

  // ─── SG&A months covered ────────────────────────────────────
  let effectiveMonthlySgAndA = monthlySgAndA || 0;
  if (sgaMode === 'percent' && sgaPct > 0 && totalBacklogRevenue > 0) {
    // SG&A % of revenue annualized → monthly
    effectiveMonthlySgAndA = (totalBacklogRevenue * sgaPct / 100) / 12;
  }
  const sgaMonthsCovered = effectiveMonthlySgAndA > 0
    ? totalBacklogGM / effectiveMonthlySgAndA
    : null;

  // Pipeline metrics from opportunities
  let backlogSoldNotContracted = 0;
  let highPotentialBacklog     = 0;
  const awardedNotInVistaOpps  = [];
  const highPotentialOpps      = [];

  const EXCLUDED_STAGES = new Set(['Won', 'Lost', 'Passed']);

  for (const opp of (opportunities || [])) {
    const div = opp.location_group || null;

    if (divisionFilter && divisionFilter !== 'all' && div !== divisionFilter) continue;

    const estValue = parseNum(opp.estimated_value);
    if (estValue <= 0) continue;

    const stageName = opp.stage_name || '';

    // Awarded Not in Vista — awarded_status is '' (empty) when not yet in Vista
    if (stageName === 'Awarded' && (opp.awarded_status === '' || opp.awarded_status == null)) {
      backlogSoldNotContracted += estValue;
      awardedNotInVistaOpps.push({
        id:           opp.id,
        title:        opp.title || '',
        customerName: opp.customer_name || opp.client_company || '',
        estValue,
        division:     div || '',
        assignedTo:   opp.assigned_to_name || '',
      });
      continue;
    }

    // High potential = probability 'High', excluding terminal stages
    if (
      opp.probability === 'High' &&
      !EXCLUDED_STAGES.has(stageName) &&
      stageName !== 'Awarded'
    ) {
      highPotentialBacklog += estValue;
      highPotentialOpps.push({
        id:           opp.id,
        title:        opp.title || '',
        customerName: opp.customer_name || opp.client_company || '',
        estValue,
        stageName,
        division:     div || '',
        assignedTo:   opp.assigned_to_name || '',
      });
    }
  }

  awardedNotInVistaOpps.sort((a, b) => b.estValue - a.estValue);
  highPotentialOpps.sort((a, b) => b.estValue - a.estValue);

  return {
    currentFY: currentYear,
    filters: {
      divisionFilter: divisionFilter || 'all',
    },
    availableDivisions: LOCATION_GROUPS.map(g => g.value).filter(v => divNames.has(v)),

    // Backlog burn by FY
    currentFYRevenue,
    futureFYRevenue,
    totalBacklogRevenue,

    // GM on backlog by FY
    currentFYGM,
    futureFYGM,
    totalBacklogGM,

    // SG&A
    monthlySgAndA:    effectiveMonthlySgAndA,
    sgaMode:          sgaMode || 'dollar',
    sgaPct:           sgaPct  || 0,
    sgaMonthsCovered,

    // Scenario
    scenario:         scenario || 'actual',
    scenarioMultiplier,
    conservativePct:  conservativePct ?? 10,
    aggressivePct:    aggressivePct   ?? 10,

    // Pipeline totals
    backlogSoldNotContracted,
    highPotentialBacklog,

    // Detail rows
    contractDetails,
    awardedNotInVistaOpps,
    highPotentialOpps,
  };
}

module.exports = { buildBacklogAnalysis, LOCATION_GROUPS };
