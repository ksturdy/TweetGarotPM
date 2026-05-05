const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const VistaData = require('../models/VistaData');
const { calcBacklogSnapshot } = require('../utils/backlogFitCalculator');

router.use(authenticate);
router.use(tenantContext);

/**
 * Compute the Monday of the current week (ISO week: Mon-Sun).
 */
function getCurrentMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// SQL expression to derive location_group: use the explicit field first,
// fall back to the assigned employee's department code prefix.
const LOC_GROUP_EXPR = `COALESCE(
  o.location_group,
  CASE LEFT(d.department_number, 2)
    WHEN '10' THEN 'NEW'
    WHEN '20' THEN 'CW'
    WHEN '30' THEN 'WW'
    WHEN '40' THEN 'AZ'
  END,
  'NONE'
)`;

/**
 * Build weekly sales report data for a given week.
 * @param {number} tenantId
 * @param {string} weekStart - YYYY-MM-DD (Monday)
 * @returns {Promise<Object>}
 */
async function buildWeeklySalesData(tenantId, weekStart) {
  // Query 1: New opportunities this week
  const newOppsResult = await db.query(`
    SELECT
      o.id, o.title, o.estimated_value,
      ${LOC_GROUP_EXPR} AS location_group,
      o.stage_id, o.priority, o.created_at,
      ps.name AS stage_name, ps.color AS stage_color,
      e.first_name || ' ' || e.last_name AS assigned_to_name,
      COALESCE(c.name, c.customer_owner) AS customer_name
    FROM opportunities o
    LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
    LEFT JOIN employees e ON o.assigned_to = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.tenant_id = $1
      AND o.created_at >= $2::date
      AND o.created_at < ($2::date + INTERVAL '7 days')
    ORDER BY location_group, o.created_at DESC
  `, [tenantId, weekStart]);

  // Query 2: Previous week opp counts (for delta)
  const prevOppsResult = await db.query(`
    SELECT
      ${LOC_GROUP_EXPR} AS location_group,
      COUNT(*)::int AS opp_count,
      COALESCE(SUM(o.estimated_value), 0)::numeric AS opp_value
    FROM opportunities o
    LEFT JOIN employees e ON o.assigned_to = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE o.tenant_id = $1
      AND o.created_at >= ($2::date - INTERVAL '7 days')
      AND o.created_at < $2::date
    GROUP BY ${LOC_GROUP_EXPR}
  `, [tenantId, weekStart]);

  // Query 3: Activities this week
  const activitiesResult = await db.query(`
    SELECT
      oa.id, oa.opportunity_id, oa.activity_type, oa.subject,
      oa.completed_at, oa.is_completed, oa.created_at,
      ${LOC_GROUP_EXPR} AS location_group,
      o.title AS opportunity_title,
      u.first_name || ' ' || u.last_name AS created_by_name
    FROM opportunity_activities oa
    JOIN opportunities o ON oa.opportunity_id = o.id
    LEFT JOIN employees e ON o.assigned_to = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN users u ON oa.created_by = u.id
    WHERE o.tenant_id = $1
      AND oa.created_at >= $2::date
      AND oa.created_at < ($2::date + INTERVAL '7 days')
    ORDER BY location_group, oa.created_at DESC
  `, [tenantId, weekStart]);

  // Query 4: Won/Lost this week
  const wonLostResult = await db.query(`
    SELECT
      o.id, o.title, o.estimated_value,
      ${LOC_GROUP_EXPR} AS location_group,
      o.updated_at, o.lost_reason,
      ps.name AS stage_name,
      e.first_name || ' ' || e.last_name AS assigned_to_name,
      COALESCE(c.name, c.customer_owner) AS customer_name
    FROM opportunities o
    JOIN pipeline_stages ps ON o.stage_id = ps.id
    LEFT JOIN employees e ON o.assigned_to = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.tenant_id = $1
      AND o.updated_at >= $2::date
      AND o.updated_at < ($2::date + INTERVAL '7 days')
      AND LOWER(ps.name) IN ('won', 'lost', 'awarded', 'closed won', 'closed lost')
    ORDER BY location_group, o.updated_at DESC
  `, [tenantId, weekStart]);

  // Query 5: Previous week activity counts (for delta)
  const prevActivitiesResult = await db.query(`
    SELECT
      ${LOC_GROUP_EXPR} AS location_group,
      COUNT(*)::int AS activity_count
    FROM opportunity_activities oa
    JOIN opportunities o ON oa.opportunity_id = o.id
    LEFT JOIN employees e ON o.assigned_to = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE o.tenant_id = $1
      AND oa.created_at >= ($2::date - INTERVAL '7 days')
      AND oa.created_at < $2::date
    GROUP BY ${LOC_GROUP_EXPR}
  `, [tenantId, weekStart]);

  // Query 5b: Previous week won/lost counts (for delta)
  const prevWonLostResult = await db.query(`
    SELECT
      CASE WHEN LOWER(ps.name) IN ('won', 'awarded', 'closed won') THEN 'won' ELSE 'lost' END AS result,
      COUNT(*)::int AS cnt,
      COALESCE(SUM(o.estimated_value), 0)::numeric AS total_value
    FROM opportunities o
    JOIN pipeline_stages ps ON o.stage_id = ps.id
    LEFT JOIN employees e ON o.assigned_to = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE o.tenant_id = $1
      AND o.updated_at >= ($2::date - INTERVAL '7 days')
      AND o.updated_at < $2::date
      AND LOWER(ps.name) IN ('won', 'lost', 'awarded', 'closed won', 'closed lost')
    GROUP BY result
  `, [tenantId, weekStart]);

  // Query 6: Company backlog metrics (overall, weighted GM%, average project GM%)
  // GM% stored as decimal (0.15 = 15%) — multiply by 100 for display.
  // Apply GM override: when real GM is ~100% and override is set, use override value.
  const GM_EXPR = `CASE WHEN COALESCE(vc.gross_profit_percent, p.gross_margin_percent) >= 0.995
                        AND p.override_gm_percent IS NOT NULL
                   THEN p.override_gm_percent
                   ELSE COALESCE(vc.gross_profit_percent, p.gross_margin_percent) END`;

  const backlogResult = await db.query(`
    SELECT
      COALESCE(SUM(COALESCE(vc.backlog, p.backlog)), 0)::numeric AS total_backlog,
      CASE
        WHEN SUM(COALESCE(vc.backlog, p.backlog)) > 0
        THEN (
          SUM(COALESCE(vc.backlog, p.backlog) * (${GM_EXPR}))
          / SUM(CASE WHEN (${GM_EXPR}) IS NOT NULL THEN COALESCE(vc.backlog, p.backlog) ELSE 0 END)
        ) * 100
        ELSE NULL
      END AS weighted_gm_pct,
      CASE
        WHEN COUNT(${GM_EXPR}) > 0
        THEN AVG(${GM_EXPR}) * 100
        ELSE NULL
      END AS avg_project_gm_pct,
      COUNT(*) FILTER (WHERE COALESCE(vc.gross_profit_percent, p.gross_margin_percent) >= 0.995
                         AND p.override_gm_percent IS NOT NULL)::int AS gm_override_count
    FROM projects p
    LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
    WHERE p.tenant_id = $1
      AND COALESCE(vc.backlog, p.backlog) > 0
      AND p.status NOT IN ('completed', 'cancelled', 'Hard-Closed')
  `, [tenantId]);

  // Backlog projections: use the contour-based revenue projection system (same as backlog fit report).
  // Computes per-contract remaining backlog at 6 and 12 months with weighted GM%.
  const contracts = await VistaData.getAllContracts({ status: '' }, tenantId);

  // Fetch GM overrides for linked projects so calcBacklogSnapshot can apply them
  const overrideRows = await db.query(`
    SELECT vc.id AS contract_id, p.override_gm_percent
    FROM projects p
    JOIN vp_contracts vc ON vc.linked_project_id = p.id
    WHERE p.tenant_id = $1 AND p.override_gm_percent IS NOT NULL
  `, [tenantId]);
  const overrideMap = {};
  for (const r of overrideRows.rows) {
    overrideMap[r.contract_id] = parseFloat(r.override_gm_percent);
  }

  const snapshot = calcBacklogSnapshot(contracts, overrideMap);

  // Query 7: Newly created contracts this week (from vp_contracts).
  // Sourced from vp_contracts so the section reflects contracts that came in
  // from Vista, not shell project records. Manager/department fall back through
  // the linked project since contract-level employee/department links are often
  // null on import.
  // Sub-jobs (e.g. "44448-10", "44448-20") are excluded — only parent
  // contracts (whose Vista contract_number has no hyphen suffix) are shown.
  const newJobsResult = await db.query(`
    SELECT
      vc.id,
      COALESCE(p.name, vc.description) AS name,
      vc.contract_number AS number,
      vc.status,
      vc.contract_amount AS contract_value,
      CASE WHEN vc.gross_profit_percent >= 0.995
                AND p.override_gm_percent IS NOT NULL
           THEN p.override_gm_percent * 100
           ELSE vc.gross_profit_percent * 100 END AS gross_margin_percent,
      (vc.gross_profit_percent >= 0.995
       AND p.override_gm_percent IS NOT NULL) AS gm_overridden,
      vc.created_at,
      COALESCE(
        pe.first_name || ' ' || pe.last_name,
        vce.first_name || ' ' || vce.last_name,
        vc.project_manager_name
      ) AS manager_name,
      COALESCE(c.name, vc.customer_name) AS customer_name,
      d.name AS department_name
    FROM vp_contracts vc
    LEFT JOIN projects p ON vc.linked_project_id = p.id
    LEFT JOIN employees vce ON vc.linked_employee_id = vce.id
    LEFT JOIN employees pe ON p.manager_id = pe.id
    LEFT JOIN customers c ON vc.linked_customer_id = c.id
    LEFT JOIN departments d ON COALESCE(vc.linked_department_id, p.department_id) = d.id
    WHERE vc.tenant_id = $1
      AND vc.created_at >= $2::date
      AND vc.created_at < ($2::date + INTERVAL '7 days')
      AND vc.contract_number NOT LIKE '%-%'
    ORDER BY vc.created_at DESC
  `, [tenantId, weekStart]);

  // Build previous-week lookup maps
  const prevOppsByLoc = {};
  for (const row of prevOppsResult.rows) {
    prevOppsByLoc[row.location_group] = { count: parseInt(row.opp_count), value: parseFloat(row.opp_value) || 0 };
  }
  const prevActByLoc = {};
  for (const row of prevActivitiesResult.rows) {
    prevActByLoc[row.location_group] = parseInt(row.activity_count);
  }

  // Group data by location
  const locations = ['NEW', 'CW', 'WW', 'AZ', 'NONE'];
  const byLocation = {};

  for (const loc of locations) {
    const opps = newOppsResult.rows.filter(r => r.location_group === loc);
    const acts = activitiesResult.rows.filter(r => r.location_group === loc);
    const wl = wonLostResult.rows.filter(r => r.location_group === loc);

    if (loc === 'NONE' && opps.length === 0 && acts.length === 0 && wl.length === 0) {
      continue; // only skip Unassigned when truly empty
    }

    const activityBreakdown = { call: 0, meeting: 0, email: 0, note: 0, task: 0, voice_note: 0 };
    for (const a of acts) {
      if (activityBreakdown[a.activity_type] !== undefined) {
        activityBreakdown[a.activity_type]++;
      }
    }

    const wonRows = wl.filter(r => r.stage_name && /won|awarded/i.test(r.stage_name));
    const lostRows = wl.filter(r => r.stage_name && /lost/i.test(r.stage_name));

    const prev = prevOppsByLoc[loc] || { count: 0, value: 0 };

    byLocation[loc] = {
      summary: {
        new_opp_count: opps.length,
        new_opp_value: opps.reduce((s, o) => s + (parseFloat(o.estimated_value) || 0), 0),
        prev_new_opp_count: prev.count,
        prev_new_opp_value: prev.value,
        activity_count: acts.length,
        prev_activity_count: prevActByLoc[loc] || 0,
        ...activityBreakdown,
        won_count: wonRows.length,
        won_value: wonRows.reduce((s, o) => s + (parseFloat(o.estimated_value) || 0), 0),
        lost_count: lostRows.length,
      },
      new_opportunities: opps,
      activities: acts,
      won_lost: wl,
    };
  }

  // Build previous-week won/lost lookup
  const prevWonLost = { won_count: 0, won_value: 0, lost_count: 0 };
  for (const row of prevWonLostResult.rows) {
    if (row.result === 'won') {
      prevWonLost.won_count = parseInt(row.cnt);
      prevWonLost.won_value = parseFloat(row.total_value) || 0;
    } else {
      prevWonLost.lost_count = parseInt(row.cnt);
    }
  }

  // Compute totals
  const allLocs = Object.values(byLocation);
  const totals = {
    new_opp_count: 0, new_opp_value: 0,
    prev_new_opp_count: 0, prev_new_opp_value: 0,
    activity_count: 0, prev_activity_count: 0,
    call: 0, meeting: 0, email: 0, note: 0, task: 0, voice_note: 0,
    won_count: 0, won_value: 0, lost_count: 0,
    prev_won_count: prevWonLost.won_count,
    prev_won_value: prevWonLost.won_value,
    prev_lost_count: prevWonLost.lost_count,
  };
  for (const loc of allLocs) {
    for (const key of Object.keys(totals)) {
      if (key.startsWith('prev_won') || key.startsWith('prev_lost')) continue;
      totals[key] += loc.summary[key] || 0;
    }
  }

  // Compute week_end (Sunday)
  const startDate = new Date(weekStart + 'T00:00:00');
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const weekEnd = endDate.toISOString().split('T')[0];

  // Parse backlog metrics — combine SQL totals with contour-based projections.
  // Non-VP project backlogs (included in SQL total but not in contour projections)
  // are treated as persisting at all horizons.
  const backlogRow = backlogResult.rows[0] || {};
  const totalBacklog = parseFloat(backlogRow.total_backlog) || 0;
  const vpBacklogTotal = snapshot.backlog_6mo + (totalBacklog - snapshot.backlog_6mo - (totalBacklog - snapshot.backlog_6mo)); // just use snapshot directly
  const nonVpBacklog = Math.max(0, totalBacklog - contracts.reduce((s, c) => {
    const st = (c.status || '').toLowerCase();
    if (!st.includes('open') && !st.includes('soft')) return s;
    return s + (parseFloat(c.backlog) || 0);
  }, 0));
  const company_snapshot = {
    total_backlog: totalBacklog,
    backlog_6mo: snapshot.backlog_6mo + nonVpBacklog,
    backlog_6mo_gm_pct: snapshot.backlog_6mo_gm_pct,
    backlog_12mo: snapshot.backlog_12mo + nonVpBacklog,
    backlog_12mo_gm_pct: snapshot.backlog_12mo_gm_pct,
    weighted_gm_pct: backlogRow.weighted_gm_pct != null ? parseFloat(backlogRow.weighted_gm_pct) : null,
    avg_project_gm_pct: backlogRow.avg_project_gm_pct != null ? parseFloat(backlogRow.avg_project_gm_pct) : null,
    gm_override_count: parseInt(backlogRow.gm_override_count) || 0,
  };

  // Persist snapshot only when the requested week is the actual current week.
  // Why: company_snapshot is computed from CURRENT projects/contracts data — it
  // has no historical view. Upserting on every visit (the old behavior) would
  // overwrite past weeks' snapshots with today's numbers, making prev-week
  // comparisons always show "No change". By writing only when weekStart equals
  // the real-current Monday, snapshots get captured during their actual week
  // and frozen thereafter.
  const currentRealMonday = getCurrentMonday();
  if (weekStart === currentRealMonday) {
    try {
      await db.query(`
        INSERT INTO weekly_report_snapshots
          (tenant_id, week_start, total_backlog, backlog_6mo, backlog_6mo_gm_pct,
           backlog_12mo, backlog_12mo_gm_pct, weighted_gm_pct, avg_project_gm_pct)
        VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (tenant_id, week_start)
        DO UPDATE SET
          total_backlog = EXCLUDED.total_backlog,
          backlog_6mo = EXCLUDED.backlog_6mo,
          backlog_6mo_gm_pct = EXCLUDED.backlog_6mo_gm_pct,
          backlog_12mo = EXCLUDED.backlog_12mo,
          backlog_12mo_gm_pct = EXCLUDED.backlog_12mo_gm_pct,
          weighted_gm_pct = EXCLUDED.weighted_gm_pct,
          avg_project_gm_pct = EXCLUDED.avg_project_gm_pct,
          created_at = NOW()
      `, [
        tenantId, weekStart,
        company_snapshot.total_backlog, company_snapshot.backlog_6mo, company_snapshot.backlog_6mo_gm_pct,
        company_snapshot.backlog_12mo, company_snapshot.backlog_12mo_gm_pct,
        company_snapshot.weighted_gm_pct, company_snapshot.avg_project_gm_pct,
      ]);
    } catch (e) {
      // Non-fatal — table may not exist yet if migration hasn't run
      console.warn('Could not persist weekly snapshot:', e.message);
    }
  }

  // Fetch previous week's snapshot for comparison.
  // Only trust snapshots captured close to their own week — older code used to
  // overwrite stored snapshots whenever a past week was viewed, leaving stale
  // rows whose created_at is long after week_start. Treat those as untrusted.
  let prev_snapshot = null;
  try {
    const prevSnapResult = await db.query(`
      SELECT total_backlog, backlog_6mo, backlog_6mo_gm_pct,
             backlog_12mo, backlog_12mo_gm_pct, weighted_gm_pct, avg_project_gm_pct
      FROM weekly_report_snapshots
      WHERE tenant_id = $1
        AND week_start = ($2::date - INTERVAL '7 days')
        AND created_at < week_start + INTERVAL '7 days'
    `, [tenantId, weekStart]);
    if (prevSnapResult.rows.length > 0) {
      const r = prevSnapResult.rows[0];
      prev_snapshot = {
        total_backlog: r.total_backlog != null ? parseFloat(r.total_backlog) : null,
        backlog_6mo: r.backlog_6mo != null ? parseFloat(r.backlog_6mo) : null,
        backlog_6mo_gm_pct: r.backlog_6mo_gm_pct != null ? parseFloat(r.backlog_6mo_gm_pct) : null,
        backlog_12mo: r.backlog_12mo != null ? parseFloat(r.backlog_12mo) : null,
        backlog_12mo_gm_pct: r.backlog_12mo_gm_pct != null ? parseFloat(r.backlog_12mo_gm_pct) : null,
        weighted_gm_pct: r.weighted_gm_pct != null ? parseFloat(r.weighted_gm_pct) : null,
        avg_project_gm_pct: r.avg_project_gm_pct != null ? parseFloat(r.avg_project_gm_pct) : null,
      };
    }
  } catch (e) {
    // Non-fatal
    console.warn('Could not fetch previous weekly snapshot:', e.message);
  }

  return {
    week_start: weekStart,
    week_end: weekEnd,
    totals,
    by_location: byLocation,
    company_snapshot,
    prev_snapshot,
    new_jobs: newJobsResult.rows,
  };
}

// ── PDF generation ─────────────────────────────────────────

const { generateWeeklySalesReportPdfHtml } = require('../utils/weeklySalesReportPdfGenerator');
const { fetchLogoBase64 } = require('../utils/logoFetcher');

async function generateWeeklySalesPdfBuffer(data, tenantId) {
  const { launchBrowser } = require('../utils/launchBrowser');
  const logoBase64 = await fetchLogoBase64(tenantId);
  const html = generateWeeklySalesReportPdfHtml(data, logoBase64);
  let browser = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 816, height: 1056 });
    await page.setContent(html, { waitUntil: ['load', 'domcontentloaded'], timeout: 30000 });
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) await browser.close();
  }
}

// ── Routes ─────────────────────────────────────────────────

// GET /api/reports/weekly-sales
router.get('/', async (req, res, next) => {
  try {
    const weekStart = req.query.week_start || getCurrentMonday();
    const data = await buildWeeklySalesData(req.tenantId, weekStart);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/weekly-sales/pdf-download
router.get('/pdf-download', async (req, res, next) => {
  try {
    const weekStart = req.query.week_start || getCurrentMonday();
    const data = await buildWeeklySalesData(req.tenantId, weekStart);
    const pdfBuffer = await generateWeeklySalesPdfBuffer(data, req.tenantId);

    const dateStr = weekStart;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Weekly-Sales-Report-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating weekly sales PDF:', error);
    res.status(500).json({ error: 'Failed to generate weekly sales report PDF' });
  }
});

module.exports = router;
module.exports.buildWeeklySalesData = buildWeeklySalesData;
module.exports.generateWeeklySalesPdfBuffer = generateWeeklySalesPdfBuffer;
module.exports.getCurrentMonday = getCurrentMonday;
