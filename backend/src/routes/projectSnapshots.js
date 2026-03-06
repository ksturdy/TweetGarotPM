const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ProjectSnapshot = require('../models/ProjectSnapshot');
const Project = require('../models/Project');
const VistaData = require('../models/VistaData');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { captureAllSnapshots } = require('../jobs/weeklySnapshots');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

/**
 * GET /api/projects/:projectId/snapshots
 * Get all historical snapshots for a project
 */
router.get('/:projectId/snapshots', async (req, res) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const snapshots = await ProjectSnapshot.getByProject(Number(projectId), tenantId);

    res.json(snapshots);
  } catch (error) {
    console.error('Error fetching project snapshots:', error);
    res.status(500).json({ error: 'Failed to fetch project snapshots' });
  }
});

/**
 * POST /api/projects/:projectId/snapshots
 * Create a new snapshot for a project (manual capture)
 */
router.post('/:projectId/snapshots', async (req, res) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.id;

    // Get the custom snapshot date from request, or use today
    const snapshotDate = req.body.snapshotDate || new Date().toISOString().split('T')[0];

    // Fetch current Vista data and project (for margin overrides)
    const vistaContract = await VistaData.getContractByProjectId(Number(projectId), tenantId);

    if (!vistaContract) {
      return res.status(404).json({ error: 'No Vista contract linked to this project' });
    }

    const project = await Project.findByIdAndTenant(Number(projectId), tenantId);

    // Calculate percent complete (earned / projected revenue)
    const percentComplete = vistaContract.projected_revenue && vistaContract.projected_revenue > 0
      ? vistaContract.earned_revenue / vistaContract.projected_revenue
      : null;

    // Create snapshot with Vista data
    const snapshotData = {
      projectId: Number(projectId),
      tenantId,
      snapshotDate,
      createdBy: userId,
      vistaData: {
        // Contract Values
        orig_contract_amount: vistaContract.orig_contract_amount,
        contract_amount: vistaContract.contract_amount,
        approved_changes: vistaContract.approved_changes,
        pending_change_orders: vistaContract.pending_change_orders,
        change_order_count: vistaContract.change_order_count,

        // Revenue & Progress
        projected_revenue: vistaContract.projected_revenue,
        earned_revenue: vistaContract.earned_revenue,
        backlog: vistaContract.backlog,
        percent_complete: percentComplete,

        // Margin
        gross_profit_dollars: vistaContract.gross_profit_dollars,
        gross_profit_percent: vistaContract.gross_profit_percent,
        original_estimated_margin: project.override_original_estimated_margin ?? vistaContract.original_estimated_margin,
        original_estimated_margin_pct: project.override_original_estimated_margin_pct ?? vistaContract.original_estimated_margin_pct,

        // Billing & AR
        billed_amount: vistaContract.billed_amount,
        received_amount: vistaContract.received_amount,
        open_receivables: vistaContract.open_receivables,
        cash_flow: vistaContract.cash_flow,

        // Costs
        actual_cost: vistaContract.actual_cost,
        projected_cost: vistaContract.projected_cost,
        current_est_cost: vistaContract.current_est_cost,

        // Labor
        actual_labor_rate: vistaContract.actual_labor_rate,
        estimated_labor_rate: vistaContract.estimated_labor_rate,
        current_est_labor_cost: vistaContract.current_est_labor_cost,
        ttl_labor_projected: vistaContract.ttl_labor_projected,

        // Material
        material_estimate: vistaContract.material_estimate,
        material_jtd: vistaContract.material_jtd,
        material_projected: vistaContract.material_projected,

        // Subcontracts
        subcontracts_estimate: vistaContract.subcontracts_estimate,
        subcontracts_jtd: vistaContract.subcontracts_jtd,
        subcontracts_projected: vistaContract.subcontracts_projected,

        // Rentals
        rentals_estimate: vistaContract.rentals_estimate,
        rentals_jtd: vistaContract.rentals_jtd,
        rentals_projected: vistaContract.rentals_projected,

        // MEP Equipment
        mep_equip_estimate: vistaContract.mep_equip_estimate,
        mep_equip_jtd: vistaContract.mep_equip_jtd,
        mep_equip_projected: vistaContract.mep_equip_projected,

        // Hours - Pipefitter
        pf_hours_estimate: vistaContract.pf_hours_estimate,
        pf_hours_jtd: vistaContract.pf_hours_jtd,
        pf_hours_projected: vistaContract.pf_hours_projected,

        // Hours - Sheet Metal
        sm_hours_estimate: vistaContract.sm_hours_estimate,
        sm_hours_jtd: vistaContract.sm_hours_jtd,
        sm_hours_projected: vistaContract.sm_hours_projected,

        // Hours - Plumbing
        pl_hours_estimate: vistaContract.pl_hours_estimate,
        pl_hours_jtd: vistaContract.pl_hours_jtd,
        pl_hours_projected: vistaContract.pl_hours_projected,

        // Hours - Total
        total_hours_estimate: vistaContract.total_hours_estimate,
        total_hours_jtd: vistaContract.total_hours_jtd,
        total_hours_projected: vistaContract.total_hours_projected,
      }
    };

    const snapshot = await ProjectSnapshot.create(snapshotData);

    res.status(201).json(snapshot);
  } catch (error) {
    console.error('Error creating project snapshot:', error);
    res.status(500).json({ error: 'Failed to create project snapshot' });
  }
});

/**
 * GET /api/projects/:projectId/snapshots/latest
 * Get the most recent snapshot for a project
 */
router.get('/:projectId/snapshots/latest', async (req, res) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const snapshot = await ProjectSnapshot.getLatest(Number(projectId), tenantId);

    if (!snapshot) {
      return res.status(404).json({ error: 'No snapshots found for this project' });
    }

    res.json(snapshot);
  } catch (error) {
    console.error('Error fetching latest snapshot:', error);
    res.status(500).json({ error: 'Failed to fetch latest snapshot' });
  }
});

/**
 * POST /api/projects/snapshots/capture-all
 * Manually trigger bulk snapshot capture for all active/open projects (admin only)
 */
router.post('/snapshots/capture-all', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await captureAllSnapshots();
    res.json({
      message: 'Bulk snapshot capture complete',
      ...result
    });
  } catch (error) {
    console.error('Error during bulk snapshot capture:', error);
    res.status(500).json({ error: 'Failed to capture snapshots' });
  }
});

/**
 * PATCH /api/projects/:projectId/snapshots/backfill-margin
 * Retroactively update all existing snapshots with the current margin overrides
 */
router.patch('/:projectId/snapshots/backfill-margin', async (req, res) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const project = await Project.findByIdAndTenant(Number(projectId), tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.override_original_estimated_margin == null &&
        project.override_original_estimated_margin_pct == null) {
      return res.status(400).json({ error: 'No margin overrides set on this project' });
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (project.override_original_estimated_margin != null) {
      setClauses.push(`original_estimated_margin = $${paramIndex++}`);
      values.push(project.override_original_estimated_margin);
    }
    if (project.override_original_estimated_margin_pct != null) {
      setClauses.push(`original_estimated_margin_pct = $${paramIndex++}`);
      values.push(project.override_original_estimated_margin_pct);
    }

    values.push(Number(projectId), tenantId);

    const result = await db.query(
      `UPDATE project_snapshots SET ${setClauses.join(', ')}
       WHERE project_id = $${paramIndex++} AND tenant_id = $${paramIndex}`,
      values
    );

    res.json({
      message: `Updated ${result.rowCount} snapshots with margin overrides`,
      snapshotsUpdated: result.rowCount
    });
  } catch (error) {
    console.error('Error backfilling margin overrides:', error);
    res.status(500).json({ error: 'Failed to backfill margin overrides' });
  }
});

module.exports = router;
