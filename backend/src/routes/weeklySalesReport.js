const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

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

    if (opps.length === 0 && acts.length === 0 && wl.length === 0 && !prevOppsByLoc[loc] && !prevActByLoc[loc]) {
      continue; // skip empty locations
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

  // Compute totals
  const allLocs = Object.values(byLocation);
  const totals = {
    new_opp_count: 0, new_opp_value: 0,
    prev_new_opp_count: 0, prev_new_opp_value: 0,
    activity_count: 0, prev_activity_count: 0,
    call: 0, meeting: 0, email: 0, note: 0, task: 0, voice_note: 0,
    won_count: 0, won_value: 0, lost_count: 0,
  };
  for (const loc of allLocs) {
    for (const key of Object.keys(totals)) {
      totals[key] += loc.summary[key] || 0;
    }
  }

  // Compute week_end (Sunday)
  const startDate = new Date(weekStart + 'T00:00:00');
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const weekEnd = endDate.toISOString().split('T')[0];

  return { week_start: weekStart, week_end: weekEnd, totals, by_location: byLocation };
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
