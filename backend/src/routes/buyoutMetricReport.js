const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

const COST_TYPE_NAMES = {
  1: 'Labor',
  2: 'Material',
  3: 'Subcontracts',
  4: 'Rentals',
  5: 'MEP Equipment',
  6: 'General Conditions',
};

/**
 * Shared data builder for buyout metric report.
 * Aggregates est_cost, jtd_cost, committed_cost, projected_cost from vp_phase_codes
 * by project, filtered by cost types.
 *
 * @param {number} tenantId
 * @param {Object} filters
 * @returns {Promise<Array>}
 */
async function buildBuyoutMetricData(tenantId, filters = {}) {
  const costTypes = filters.cost_types && filters.cost_types.length > 0
    ? filters.cost_types.map(Number)
    : [3, 5]; // Default: Subcontracts + MEP Equipment

  const result = await db.query(
    `SELECT
       p.id,
       p.number,
       p.name,
       p.status,
       p.market,
       p.manager_id,
       e.first_name || ' ' || e.last_name AS manager_name,
       d.department_number,
       COALESCE(c.name, c.customer_owner, p.client) AS customer_name,
       pc.phase,
       MAX(pc.phase_description) AS phase_description,
       COALESCE(SUM(pc.est_cost), 0) AS est_cost,
       COALESCE(SUM(pc.jtd_cost), 0) AS jtd_cost,
       COALESCE(SUM(pc.committed_cost), 0) AS committed_cost,
       COALESCE(SUM(pc.projected_cost), 0) AS projected_cost,
       CASE
         WHEN vc.projected_cost > 0 THEN (vc.actual_cost / vc.projected_cost)
         ELSE NULL
       END AS percent_complete
     FROM projects p
     LEFT JOIN employees e ON p.manager_id = e.id
     LEFT JOIN departments d ON p.department_id = d.id
     LEFT JOIN customers c ON p.customer_id = c.id
     LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
     JOIN vp_phase_codes pc ON pc.linked_project_id = p.id
       AND pc.cost_type = ANY($2::int[])
     WHERE p.tenant_id = $1
     GROUP BY p.id, p.number, p.name, p.status, p.market, p.manager_id,
              e.first_name, e.last_name, d.department_number,
              c.name, c.customer_owner, p.client,
              vc.projected_cost, vc.actual_cost,
              pc.phase
     ORDER BY p.number ASC, pc.phase ASC`,
    [tenantId, costTypes]
  );

  let rows = result.rows.map(r => {
    const est = parseFloat(r.est_cost) || 0;
    const jtd = parseFloat(r.jtd_cost) || 0;
    const committed = parseFloat(r.committed_cost) || 0;
    const projected = parseFloat(r.projected_cost) || 0;
    const pct = r.percent_complete !== null ? parseFloat(r.percent_complete) : null;
    return {
      ...r,
      phase: r.phase || '',
      phase_description: r.phase_description || '',
      est_cost: est,
      jtd_cost: jtd,
      committed_cost: committed,
      projected_cost: projected,
      buyout_remaining: projected - committed - jtd,
      percent_complete: pct,
    };
  });

  // Filter: minimum percent complete (default 10%)
  const minPct = filters.min_percent_complete !== undefined
    ? parseFloat(filters.min_percent_complete)
    : 0.10;
  if (minPct > 0) {
    rows = rows.filter(r => r.percent_complete !== null && r.percent_complete >= minPct);
  }

  // Filter: status
  if (filters.status && filters.status !== 'all') {
    rows = rows.filter(r => r.status === filters.status);
  }

  // Filter: project manager
  if (filters.pm && filters.pm !== 'all') {
    rows = rows.filter(r => r.manager_name === filters.pm);
  }

  // Filter: department
  if (filters.department && filters.department !== 'all') {
    rows = rows.filter(r => r.department_number === filters.department);
  }

  // Filter: market
  if (filters.market && filters.market !== 'all') {
    rows = rows.filter(r => r.market === filters.market);
  }

  // Filter: team
  if (filters.team) {
    const Team = require('../models/Team');
    const members = await Team.getMembers(Number(filters.team), tenantId);
    const employeeIds = new Set(members.map(m => m.employee_id));
    rows = rows.filter(r => r.manager_id && employeeIds.has(r.manager_id));
  }

  // Filter: search
  if (filters.search) {
    const term = filters.search.toLowerCase();
    rows = rows.filter(r =>
      (r.name && r.name.toLowerCase().includes(term)) ||
      (r.number && String(r.number).toLowerCase().includes(term)) ||
      (r.customer_name && r.customer_name.toLowerCase().includes(term)) ||
      (r.manager_name && r.manager_name.toLowerCase().includes(term))
    );
  }

  // Exclude projects with zero cost across all columns (no phase code data for selected types)
  rows = rows.filter(r => r.est_cost !== 0 || r.jtd_cost !== 0 || r.committed_cost !== 0 || r.projected_cost !== 0);

  return rows;
}

/**
 * GET /api/reports/buyout-metric
 * Returns project-level buyout metric data
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      cost_types: req.query.cost_types ? String(req.query.cost_types).split(',').map(Number) : undefined,
      min_percent_complete: req.query.min_percent_complete,
      status: req.query.status,
      pm: req.query.pm,
      department: req.query.department,
      market: req.query.market,
      search: req.query.search,
      team: req.query.team,
    };

    const rows = await buildBuyoutMetricData(req.tenantId, filters);
    res.json(rows);
  } catch (error) {
    console.error('Buyout metric report error:', error);
    res.status(500).json({ error: 'Failed to load buyout metric data' });
  }
});

/**
 * GET /api/reports/buyout-metric/pdf-download
 * Download Buyout Metric Report as PDF
 */
router.get('/pdf-download', async (req, res) => {
  try {
    const { generateBuyoutMetricReportPdfBuffer } = require('../utils/buyoutMetricReportPdfBuffer');

    const filters = {
      cost_types: req.query.cost_types ? String(req.query.cost_types).split(',').map(Number) : undefined,
      min_percent_complete: req.query.min_percent_complete,
      status: req.query.status,
      pm: req.query.pm,
      department: req.query.department,
      market: req.query.market,
      search: req.query.search,
      team: req.query.team,
    };

    // Resolve team name for display
    if (filters.team) {
      const Team = require('../models/Team');
      const team = await Team.getByIdAndTenant(Number(filters.team), req.tenantId);
      if (team) filters.teamName = team.name;
    }

    const rows = await buildBuyoutMetricData(req.tenantId, filters);
    rows.sort((a, b) => (b.buyout_remaining || 0) - (a.buyout_remaining || 0));

    const pdfBuffer = await generateBuyoutMetricReportPdfBuffer(rows, filters);

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Buyout-Metric-Report-${dateStr}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating buyout metric report PDF:', error);
    res.status(500).json({ error: 'Failed to generate buyout metric report PDF' });
  }
});

module.exports = router;
module.exports.buildBuyoutMetricData = buildBuyoutMetricData;
