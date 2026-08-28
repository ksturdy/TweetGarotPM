const db = require('../config/database');

// Mirrors the duration table used by the Labor/Revenue Forecast modules
// (backlogFitCalculator.js). Months are total project duration based on
// contract value; remaining = total * (1 - pctComplete).
const PROJECT_DURATION_RULES = [
  { minValue: 0, maxValue: 500000, months: 3 },
  { minValue: 500000, maxValue: 2000000, months: 6 },
  { minValue: 2000000, maxValue: 5000000, months: 8 },
  { minValue: 5000000, maxValue: 10000000, months: 12 },
  { minValue: 10000000, maxValue: Infinity, months: 24 },
];

const parseNum = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

const getDurationMonths = (value) => {
  for (const r of PROJECT_DURATION_RULES) {
    if (value >= r.minValue && value < r.maxValue) return r.months;
  }
  return 24;
};

const isoDate = (d) => d.toISOString().slice(0, 10);

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

/**
 * Compute the effective start + end date for a project, used as the default
 * for new labor assignments. Falls back through this precedence:
 *   end_date:
 *     1. vp_contracts.user_adjusted_end_date (user override)
 *     2. today + remainingMonths (computed from contract value + % complete)
 *     3. projects.end_date
 *     4. null
 *   start_date:
 *     1. vp_contracts.user_adjusted_start_date (user override)
 *     2. projects.start_date
 *     3. today (the floor — never earlier than today)
 */
async function getProjectEffectiveDates(projectId, tenantId) {
  const result = await db.query(
    `SELECT p.id, p.start_date AS project_start, p.end_date AS project_end,
            -- Aggregate across all linked contracts so sub-jobs don't shadow the main contract's dates
            MIN(c.user_adjusted_start_date) AS user_adjusted_start_date,
            MAX(c.user_adjusted_end_date)   AS user_adjusted_end_date,
            SUM(c.contract_amount)          AS contract_amount,
            SUM(c.projected_revenue)        AS projected_revenue,
            SUM(c.earned_revenue)           AS earned_revenue
       FROM projects p
       LEFT JOIN vp_contracts c
              ON c.linked_project_id = p.id AND c.tenant_id = $2
      WHERE p.id = $1
      GROUP BY p.id, p.start_date, p.end_date`,
    [projectId, tenantId]
  );

  if (result.rows.length === 0) {
    return { start_date: null, end_date: null, end_source: 'none' };
  }
  const row = result.rows[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Start date ──
  // Clamp to current month start if the stored date is in the past — matches the Labor Forecast's
  // Math.max(0, offset) clamping so both views agree on projects with stale sub-job dates.
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  let start_date = null;
  if (row.user_adjusted_start_date) {
    const stored = new Date(row.user_adjusted_start_date);
    start_date = isoDate(stored < currentMonthStart ? currentMonthStart : stored);
  } else if (row.project_start) {
    start_date = isoDate(new Date(row.project_start));
  } else {
    start_date = isoDate(today);
  }

  // ── End date ──
  // Priority: vp_contracts.user_adjusted_end_date → projects.end_date → computed → null
  // projects.end_date is checked before computed because the projection PATCH route mirrors
  // user_adjusted_end_date to projects.end_date, so it represents an explicit PM choice even
  // when the vp_contracts join misses (e.g. linked_project_id not set on the contract row).
  let end_date = null;
  let end_source = 'none';
  if (row.user_adjusted_end_date) {
    end_date = isoDate(new Date(row.user_adjusted_end_date));
    end_source = 'user_override';
  } else if (row.project_end) {
    end_date = isoDate(new Date(row.project_end));
    end_source = 'project_table';
  } else if (row.contract_amount) {
    const contractValue = parseNum(row.contract_amount) || parseNum(row.projected_revenue);
    const projectedRevenue = parseNum(row.projected_revenue);
    const earnedRevenue = parseNum(row.earned_revenue);
    if (contractValue > 0) {
      const totalDuration = getDurationMonths(contractValue);
      const pctComplete = projectedRevenue > 0 ? earnedRevenue / projectedRevenue : 0;
      const remainingMonths = Math.max(1, Math.min(36, Math.ceil(totalDuration * (1 - pctComplete))));
      end_date = isoDate(addMonths(today, remainingMonths));
      end_source = 'computed';
    }
  }

  return { start_date, end_date, end_source };
}

/**
 * Mode-aware date resolver. Returns the effective start/end dates for a
 * specific cost-type segment or phase item, falling back through the hierarchy:
 *   phase → cost_type segment → summary (getProjectEffectiveDates)
 *
 * context.segmentKey — e.g. '30', '40', 'material'  (used in cost_type + phase modes)
 * context.phaseItemId — phase_schedule_items.id      (used in phase mode only)
 */
async function resolveScheduleDates(projectId, tenantId, context = {}) {
  const modeResult = await db.query(
    'SELECT scheduling_mode FROM projects WHERE id = $1 AND tenant_id = $2',
    [projectId, tenantId]
  );
  const mode = modeResult.rows[0]?.scheduling_mode ?? 'summary';

  // Phase mode: try to get dates from the specific phase item first
  if (mode === 'phase' && context.phaseItemId) {
    const phaseResult = await db.query(
      `SELECT COALESCE(start_date, manual_start_date) AS start_date,
              COALESCE(end_date, manual_end_date) AS end_date
         FROM phase_schedule_items
        WHERE id = $1 AND tenant_id = $2`,
      [context.phaseItemId, tenantId]
    );
    const phase = phaseResult.rows[0];
    if (phase?.start_date && phase?.end_date) {
      return { start_date: isoDate(new Date(phase.start_date)), end_date: isoDate(new Date(phase.end_date)), source: 'phase' };
    }
    // Fall through to cost_type / summary
  }

  // Cost type or phase fallback: try segment dates
  if ((mode === 'cost_type' || mode === 'phase') && context.segmentKey) {
    const segResult = await db.query(
      `SELECT start_date, end_date
         FROM project_schedule_segments
        WHERE project_id = $1 AND tenant_id = $2 AND segment_key = $3`,
      [projectId, tenantId, context.segmentKey]
    );
    const seg = segResult.rows[0];
    if (seg?.start_date && seg?.end_date) {
      return { start_date: isoDate(new Date(seg.start_date)), end_date: isoDate(new Date(seg.end_date)), source: 'cost_type' };
    }
  }

  // Summary fallback (always available)
  const dates = await getProjectEffectiveDates(projectId, tenantId);
  return { ...dates, source: dates.end_source };
}

module.exports = {
  getProjectEffectiveDates,
  resolveScheduleDates,
};
