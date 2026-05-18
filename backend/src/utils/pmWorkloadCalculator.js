/**
 * PM Workload Calculator
 *
 * Computes per-PM capacity health from Vista contract snapshots.
 * Pure function — takes contract rows in, returns scored output. No DB calls.
 *
 * Phase 1 signals (current snapshot only — no time-series history required):
 *   - Active project count
 *   - Backlog $ (sum of contract.backlog)
 *   - Backlog hours (sum of total_hours_estimate - total_hours_jtd, floored at 0)
 *   - Hours over estimate (sum of max(0, jtd - estimate))
 *   - % of projects over estimate (jtd > estimate)
 *   - Near-completion ratio (% of projects > 80% complete on hours)
 *   - Estimated weeks until free (backlog_hrs / current monthly burn rate)
 */

const INACTIVE_STATUSES = new Set([
  'Hard-Closed',
  'Closed',
  'Completed',
  'completed',
  'Cancelled',
  'cancelled',
]);

const DEFAULT_THRESHOLDS = {
  // Overloaded
  maxActiveProjects: 10,
  maxBacklogHours: 4000,
  maxBacklogDollars: 5_000_000,
  // Trending sideways
  forecastCreepPct: 0.30,
  hoursOverEstimateAbs: 500,
  // Available soon
  lowBacklogHours: 500,           // essentially empty book — flag regardless of project mix
  nearCompletionPct: 0.80,        // a contract counts as "near completion" if jtd/est >= 0.80
  windingDownPct: 0.60,           // > 60% of active jobs near completion
  availableWeeksHorizon: 12,      // weeks-until-free threshold for the "available soon" signal
};

function isActive(contract) {
  if (!contract.status) return true;
  return !INACTIVE_STATUSES.has(contract.status);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Match a Vista PM name ("Last, First M") against a set of "First Last" team member
 * names (lowercased). Mirrors the matcher used in forecastProjections.js so the
 * team filter behaves the same as the labor forecast / projected revenue reports.
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

function monthsBetween(start, end) {
  if (!start) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime())) return null;
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return Math.max(0.5, months); // floor at half a month to avoid divide-by-zero / explosive burn rates
}

/**
 * Aggregate a contract list into per-PM rows.
 *
 * @param {Array} contracts - rows from VistaData.getAllContracts (joined with employees, departments)
 * @param {Object} options
 *   - thresholds: tunable cutoffs (see DEFAULT_THRESHOLDS)
 *   - departmentId: optional filter
 *   - teamId: optional filter (requires teamMembers map)
 *   - teamMembers: Map<employee_id, Set<team_id>> for team filtering
 *   - now: Date for "today" (test injection)
 * @returns {Object}
 */
function buildPMWorkload(contracts, options = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) };
  const teamMembers = options.teamMembers || new Map();
  const now = options.now || new Date();

  const byPM = new Map();
  let unmatchedCount = 0;
  let unmatchedBacklogHours = 0;

  for (const c of contracts) {
    if (!isActive(c)) continue;

    if (options.departmentId) {
      if (c.linked_department_id !== options.departmentId) continue;
    }
    // Team filter: a contract matches if the linked employee is on the team
    // OR the PM name string matches a team member (handles unlinked Vista contracts).
    if (options.teamId) {
      const linkedOnTeam = c.linked_employee_id && teamMembers.get(c.linked_employee_id)?.has(options.teamId);
      const nameOnTeam = pmInTeam(c.project_manager_name, options.teamMemberNames);
      if (!linkedOnTeam && !nameOnTeam) continue;
    }

    const key = c.linked_employee_id
      ? `emp:${c.linked_employee_id}`
      : `name:${c.project_manager_name || 'Unknown'}`;

    if (!c.linked_employee_id) {
      unmatchedCount += 1;
      const est = num(c.total_hours_estimate);
      const jtd = num(c.total_hours_jtd);
      unmatchedBacklogHours += Math.max(0, est - jtd);
    }

    if (!byPM.has(key)) {
      byPM.set(key, {
        key,
        employeeId: c.linked_employee_id || null,
        pmName: c.linked_employee_name || c.project_manager_name || 'Unknown',
        departmentId: c.linked_department_id || null,
        departmentName: c.linked_department_name || null,
        linked: !!c.linked_employee_id,
        activeProjects: 0,
        backlogDollars: 0,
        backlogHours: 0,
        hoursOverEstimate: 0,
        projectsOverEstimate: 0,
        nearCompletionCount: 0,
        pfBacklogHours: 0,
        smBacklogHours: 0,
        totalMonthlyBurn: 0,        // sum of per-contract monthly burn (hrs/month)
        contractsWithStartDate: 0,  // for diagnostic — how confident is the burn rate
        contracts: [],
      });
    }
    const row = byPM.get(key);

    const est = num(c.total_hours_estimate);
    const jtd = num(c.total_hours_jtd);
    const pfEst = num(c.pf_hours_estimate);
    const pfJtd = num(c.pf_hours_jtd);
    const smEst = num(c.sm_hours_estimate);
    const smJtd = num(c.sm_hours_jtd);
    const pctComplete = est > 0 ? Math.min(1, jtd / est) : 0;

    row.activeProjects += 1;
    row.backlogDollars += num(c.backlog);
    row.backlogHours += Math.max(0, est - jtd);
    row.pfBacklogHours += Math.max(0, pfEst - pfJtd);
    row.smBacklogHours += Math.max(0, smEst - smJtd);
    row.hoursOverEstimate += Math.max(0, jtd - est);
    if (est > 0 && jtd > est) row.projectsOverEstimate += 1;
    if (pctComplete >= thresholds.nearCompletionPct) row.nearCompletionCount += 1;

    // Per-contract monthly burn = jtd / months_elapsed_since_start
    const monthsElapsed = monthsBetween(c.start_month, now);
    if (monthsElapsed && jtd > 0) {
      row.totalMonthlyBurn += jtd / monthsElapsed;
      row.contractsWithStartDate += 1;
    }

    row.contracts.push({
      contractNumber: c.contract_number,
      description: c.description,
      backlog: num(c.backlog),
      backlogHours: Math.max(0, est - jtd),
      hoursOverEstimate: Math.max(0, jtd - est),
      pctComplete,
    });
  }

  const pms = Array.from(byPM.values()).map(row => {
    const pctOverEstimate = row.activeProjects > 0
      ? row.projectsOverEstimate / row.activeProjects
      : 0;
    const nearCompletionRatio = row.activeProjects > 0
      ? row.nearCompletionCount / row.activeProjects
      : 0;

    // Weeks until free: backlog_hours / (monthly_burn / 4.33 weeks per month)
    // Only meaningful if we have a non-trivial burn rate.
    let weeksUntilFree = null;
    if (row.totalMonthlyBurn > 0 && row.backlogHours > 0) {
      const weeklyBurn = row.totalMonthlyBurn / 4.33;
      weeksUntilFree = row.backlogHours / weeklyBurn;
    } else if (row.backlogHours === 0 && row.activeProjects > 0) {
      weeksUntilFree = 0;
    }

    const overloadedReasons = [];
    const overloadedByProjects = row.activeProjects > thresholds.maxActiveProjects;
    const overloadedByHours = row.backlogHours > thresholds.maxBacklogHours;
    const overloadedByDollars = row.backlogDollars > thresholds.maxBacklogDollars;
    if (overloadedByProjects) {
      overloadedReasons.push(`${row.activeProjects} active projects (threshold ${thresholds.maxActiveProjects})`);
    }
    if (overloadedByHours) {
      overloadedReasons.push(`${Math.round(row.backlogHours).toLocaleString()} backlog hours (threshold ${thresholds.maxBacklogHours.toLocaleString()})`);
    }
    if (overloadedByDollars) {
      overloadedReasons.push(`$${(row.backlogDollars / 1_000_000).toFixed(1)}M backlog (threshold $${(thresholds.maxBacklogDollars / 1_000_000).toFixed(1)}M)`);
    }

    // "Available soon" triggers if EITHER the book is essentially empty (low backlog)
    // OR the PM is winding down AND the burn-rate projection has them free within
    // the configured horizon. Winding-down alone isn't enough — a PM with 4 near-done
    // jobs and one fresh job is still busy.
    const availableReasons = [];
    const lowBacklog = row.backlogHours < thresholds.lowBacklogHours;
    const windingDown = row.activeProjects >= 2 && nearCompletionRatio >= thresholds.windingDownPct;
    const freeingSoon = weeksUntilFree !== null && weeksUntilFree > 0 && weeksUntilFree <= thresholds.availableWeeksHorizon;
    const isAvailable = lowBacklog || (windingDown && freeingSoon);

    if (lowBacklog) {
      availableReasons.push(`${Math.round(row.backlogHours).toLocaleString()} backlog hours remaining (threshold ${thresholds.lowBacklogHours.toLocaleString()})`);
    }
    if (windingDown && freeingSoon) {
      availableReasons.push(`${row.nearCompletionCount} of ${row.activeProjects} projects past ${Math.round(thresholds.nearCompletionPct * 100)}% complete`);
    }
    if (isAvailable && weeksUntilFree !== null && weeksUntilFree > 0) {
      availableReasons.push(`projected free capacity in ~${Math.round(weeksUntilFree)} week${Math.round(weeksUntilFree) === 1 ? '' : 's'}`);
    } else if (isAvailable && weeksUntilFree === 0) {
      availableReasons.push(`free capacity available now`);
    }

    const sidewaysReasons = [];
    const sidewaysByPct = pctOverEstimate > thresholds.forecastCreepPct;
    const sidewaysByHours = row.hoursOverEstimate > thresholds.hoursOverEstimateAbs;
    if (sidewaysByPct) {
      sidewaysReasons.push(`${row.projectsOverEstimate} of ${row.activeProjects} projects over estimate (${Math.round(pctOverEstimate * 100)}%)`);
    }
    if (sidewaysByHours) {
      sidewaysReasons.push(`${Math.round(row.hoursOverEstimate).toLocaleString()} hours burnt past estimate`);
    }

    // Priority: overloaded > available > sideways > healthy.
    // An overloaded PM is never flagged as available; a freeing-up PM with some
    // over-estimate jobs is still primarily "available" (the overruns can be seen
    // in the table).
    let bucket = 'healthy';
    let reasons = [];
    if (overloadedByProjects || overloadedByHours || overloadedByDollars) {
      bucket = 'overloaded';
      reasons = overloadedReasons;
    } else if (isAvailable) {
      bucket = 'available';
      reasons = availableReasons;
    } else if (sidewaysByPct || sidewaysByHours) {
      bucket = 'sideways';
      reasons = sidewaysReasons;
    }

    return {
      ...row,
      pctOverEstimate,
      nearCompletionRatio,
      weeksUntilFree,
      bucket,
      reasons,
    };
  });

  // Sort: overloaded first, then available, then sideways, then healthy.
  // Within available: low backlog first (most available). Other buckets: backlog desc.
  const bucketRank = { overloaded: 0, available: 1, sideways: 2, healthy: 3 };
  pms.sort((a, b) => {
    if (bucketRank[a.bucket] !== bucketRank[b.bucket]) {
      return bucketRank[a.bucket] - bucketRank[b.bucket];
    }
    if (a.bucket === 'available') return a.backlogHours - b.backlogHours;
    return b.backlogHours - a.backlogHours;
  });

  return {
    pms,
    attention: {
      overloaded: pms.filter(p => p.bucket === 'overloaded'),
      available: pms.filter(p => p.bucket === 'available'),
      sideways: pms.filter(p => p.bucket === 'sideways'),
    },
    unmatched: {
      contractCount: unmatchedCount,
      backlogHours: unmatchedBacklogHours,
    },
    thresholds,
  };
}

module.exports = {
  buildPMWorkload,
  DEFAULT_THRESHOLDS,
  INACTIVE_STATUSES,
  pmInTeam,
};
