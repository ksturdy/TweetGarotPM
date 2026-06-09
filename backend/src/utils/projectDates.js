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
            c.user_adjusted_start_date, c.user_adjusted_end_date,
            c.contract_amount, c.projected_revenue, c.earned_revenue
       FROM projects p
       LEFT JOIN vp_contracts c
              ON c.linked_project_id = p.id AND c.tenant_id = $2
      WHERE p.id = $1`,
    [projectId, tenantId]
  );

  if (result.rows.length === 0) {
    return { start_date: null, end_date: null, end_source: 'none' };
  }
  const row = result.rows[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Start date ──
  let start_date = null;
  if (row.user_adjusted_start_date) {
    start_date = isoDate(new Date(row.user_adjusted_start_date));
  } else if (row.project_start) {
    start_date = isoDate(new Date(row.project_start));
  } else {
    start_date = isoDate(today);
  }

  // ── End date ──
  let end_date = null;
  let end_source = 'none';
  if (row.user_adjusted_end_date) {
    end_date = isoDate(new Date(row.user_adjusted_end_date));
    end_source = 'user_override';
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
  if (!end_date && row.project_end) {
    end_date = isoDate(new Date(row.project_end));
    end_source = 'project_table';
  }

  return { start_date, end_date, end_source };
}

module.exports = {
  getProjectEffectiveDates,
};
