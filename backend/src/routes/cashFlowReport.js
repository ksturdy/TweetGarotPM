const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.use(authenticate);
router.use(tenantContext);

/**
 * GET /api/reports/cash-flow
 * Returns project-level cash flow data from vp_contracts
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const result = await db.query(
      `SELECT
         p.id,
         p.number,
         p.name,
         p.status,
         p.market,
         p.manager_id,
         e.first_name || ' ' || e.last_name as manager_name,
         d.department_number,
         d.name as department_name,
         COALESCE(c.name, c.customer_owner, p.client) as customer_name,
         COALESCE(oc.name, oc.customer_owner) as owner_name,
         COALESCE(vc.contract_amount, p.contract_value) as contract_value,
         vc.orig_contract_amount,
         vc.earned_revenue,
         vc.billed_amount,
         vc.received_amount,
         vc.open_receivables,
         vc.cash_flow,
         vc.actual_cost,
         vc.projected_cost,
         vc.projected_revenue,
         COALESCE(vc.gross_profit_percent, p.gross_margin_percent) as gross_profit_percent,
         vc.gross_profit_dollars,
         COALESCE(vc.backlog, p.backlog) as backlog,
         vc.pending_change_orders,
         vc.approved_changes,
         vc.change_order_count,
         CASE
           WHEN vc.projected_cost > 0 THEN (vc.actual_cost / vc.projected_cost)
           ELSE NULL
         END as percent_complete
       FROM projects p
       LEFT JOIN employees e ON p.manager_id = e.id
       LEFT JOIN departments d ON p.department_id = d.id
       LEFT JOIN customers c ON p.customer_id = c.id
       LEFT JOIN customers oc ON p.owner_customer_id = oc.id
       LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
       WHERE p.tenant_id = $1
       ORDER BY p.number ASC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Cash flow report error:', error);
    res.status(500).json({ error: 'Failed to load cash flow data' });
  }
});

/**
 * GET /api/reports/cash-flow/metrics
 * Returns computed metrics from snapshot history:
 * - Average % complete when projects first turned cash-flow positive
 * - Per-project first-positive snapshot data
 */
router.get('/metrics', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // For each project, find the earliest snapshot where cash_flow > 0
    const result = await db.query(
      `WITH first_positive AS (
         SELECT DISTINCT ON (ps.project_id)
           ps.project_id,
           ps.snapshot_date,
           ps.percent_complete,
           ps.cash_flow
         FROM project_snapshots ps
         WHERE ps.cash_flow > 0
           AND ps.tenant_id = $1
         ORDER BY ps.project_id, ps.snapshot_date ASC
       )
       SELECT
         fp.project_id,
         fp.snapshot_date,
         fp.percent_complete,
         fp.cash_flow
       FROM first_positive fp`,
      [tenantId]
    );

    const rows = result.rows;
    const count = rows.length;
    const avgPctComplete = count > 0
      ? rows.reduce((sum, r) => sum + (parseFloat(r.percent_complete) || 0), 0) / count
      : 0;

    res.json({
      avg_pct_at_first_positive: avgPctComplete,
      projects_that_turned_positive: count,
      per_project: rows.map(r => ({
        project_id: r.project_id,
        first_positive_date: r.snapshot_date,
        percent_complete_at_positive: parseFloat(r.percent_complete) || 0,
      })),
    });
  } catch (error) {
    console.error('Cash flow metrics error:', error);
    res.status(500).json({ error: 'Failed to load cash flow metrics' });
  }
});

module.exports = router;
