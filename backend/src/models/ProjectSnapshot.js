const db = require('../config/database');

const ProjectSnapshot = {
  /**
   * Create a new snapshot for a project
   * @param {Object} snapshotData - Snapshot data including all Vista fields
   */
  async create(snapshotData) {
    const {
      projectId,
      tenantId,
      snapshotDate,
      vistaData,
      createdBy
    } = snapshotData;

    const result = await db.query(
      `INSERT INTO project_snapshots (
        project_id, tenant_id, snapshot_date,
        orig_contract_amount, contract_amount, approved_changes, pending_change_orders, change_order_count,
        projected_revenue, earned_revenue, backlog, percent_complete,
        gross_profit_dollars, gross_profit_percent, original_estimated_margin, original_estimated_margin_pct,
        billed_amount, received_amount, open_receivables, cash_flow,
        actual_cost, projected_cost, current_est_cost,
        actual_labor_rate, estimated_labor_rate, current_est_labor_cost, ttl_labor_projected,
        material_estimate, material_jtd, material_projected,
        subcontracts_estimate, subcontracts_jtd, subcontracts_projected,
        rentals_estimate, rentals_jtd, rentals_projected,
        mep_equip_estimate, mep_equip_jtd, mep_equip_projected,
        pf_hours_estimate, pf_hours_jtd, pf_hours_projected,
        sm_hours_estimate, sm_hours_jtd, sm_hours_projected,
        pl_hours_estimate, pl_hours_jtd, pl_hours_projected,
        total_hours_estimate, total_hours_jtd, total_hours_projected,
        created_by
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23,
        $24, $25, $26, $27,
        $28, $29, $30,
        $31, $32, $33,
        $34, $35, $36,
        $37, $38, $39,
        $40, $41, $42,
        $43, $44, $45,
        $46, $47, $48,
        $49, $50, $51,
        $52
      )
      ON CONFLICT (project_id, snapshot_date)
      DO UPDATE SET
        orig_contract_amount = EXCLUDED.orig_contract_amount,
        contract_amount = EXCLUDED.contract_amount,
        approved_changes = EXCLUDED.approved_changes,
        pending_change_orders = EXCLUDED.pending_change_orders,
        change_order_count = EXCLUDED.change_order_count,
        projected_revenue = EXCLUDED.projected_revenue,
        earned_revenue = EXCLUDED.earned_revenue,
        backlog = EXCLUDED.backlog,
        percent_complete = EXCLUDED.percent_complete,
        gross_profit_dollars = EXCLUDED.gross_profit_dollars,
        gross_profit_percent = EXCLUDED.gross_profit_percent,
        original_estimated_margin = EXCLUDED.original_estimated_margin,
        original_estimated_margin_pct = EXCLUDED.original_estimated_margin_pct,
        billed_amount = EXCLUDED.billed_amount,
        received_amount = EXCLUDED.received_amount,
        open_receivables = EXCLUDED.open_receivables,
        cash_flow = EXCLUDED.cash_flow,
        actual_cost = EXCLUDED.actual_cost,
        projected_cost = EXCLUDED.projected_cost,
        current_est_cost = EXCLUDED.current_est_cost,
        actual_labor_rate = EXCLUDED.actual_labor_rate,
        estimated_labor_rate = EXCLUDED.estimated_labor_rate,
        current_est_labor_cost = EXCLUDED.current_est_labor_cost,
        ttl_labor_projected = EXCLUDED.ttl_labor_projected,
        material_estimate = EXCLUDED.material_estimate,
        material_jtd = EXCLUDED.material_jtd,
        material_projected = EXCLUDED.material_projected,
        subcontracts_estimate = EXCLUDED.subcontracts_estimate,
        subcontracts_jtd = EXCLUDED.subcontracts_jtd,
        subcontracts_projected = EXCLUDED.subcontracts_projected,
        rentals_estimate = EXCLUDED.rentals_estimate,
        rentals_jtd = EXCLUDED.rentals_jtd,
        rentals_projected = EXCLUDED.rentals_projected,
        mep_equip_estimate = EXCLUDED.mep_equip_estimate,
        mep_equip_jtd = EXCLUDED.mep_equip_jtd,
        mep_equip_projected = EXCLUDED.mep_equip_projected,
        pf_hours_estimate = EXCLUDED.pf_hours_estimate,
        pf_hours_jtd = EXCLUDED.pf_hours_jtd,
        pf_hours_projected = EXCLUDED.pf_hours_projected,
        sm_hours_estimate = EXCLUDED.sm_hours_estimate,
        sm_hours_jtd = EXCLUDED.sm_hours_jtd,
        sm_hours_projected = EXCLUDED.sm_hours_projected,
        pl_hours_estimate = EXCLUDED.pl_hours_estimate,
        pl_hours_jtd = EXCLUDED.pl_hours_jtd,
        pl_hours_projected = EXCLUDED.pl_hours_projected,
        total_hours_estimate = EXCLUDED.total_hours_estimate,
        total_hours_jtd = EXCLUDED.total_hours_jtd,
        total_hours_projected = EXCLUDED.total_hours_projected
      RETURNING *`,
      [
        projectId, tenantId, snapshotDate,
        vistaData.orig_contract_amount, vistaData.contract_amount, vistaData.approved_changes,
        vistaData.pending_change_orders, vistaData.change_order_count,
        vistaData.projected_revenue, vistaData.earned_revenue, vistaData.backlog, vistaData.percent_complete,
        vistaData.gross_profit_dollars, vistaData.gross_profit_percent,
        vistaData.original_estimated_margin, vistaData.original_estimated_margin_pct,
        vistaData.billed_amount, vistaData.received_amount, vistaData.open_receivables, vistaData.cash_flow,
        vistaData.actual_cost, vistaData.projected_cost, vistaData.current_est_cost,
        vistaData.actual_labor_rate, vistaData.estimated_labor_rate,
        vistaData.current_est_labor_cost, vistaData.ttl_labor_projected,
        vistaData.material_estimate, vistaData.material_jtd, vistaData.material_projected,
        vistaData.subcontracts_estimate, vistaData.subcontracts_jtd, vistaData.subcontracts_projected,
        vistaData.rentals_estimate, vistaData.rentals_jtd, vistaData.rentals_projected,
        vistaData.mep_equip_estimate, vistaData.mep_equip_jtd, vistaData.mep_equip_projected,
        vistaData.pf_hours_estimate, vistaData.pf_hours_jtd, vistaData.pf_hours_projected,
        vistaData.sm_hours_estimate, vistaData.sm_hours_jtd, vistaData.sm_hours_projected,
        vistaData.pl_hours_estimate, vistaData.pl_hours_jtd, vistaData.pl_hours_projected,
        vistaData.total_hours_estimate, vistaData.total_hours_jtd, vistaData.total_hours_projected,
        createdBy
      ]
    );

    return result.rows[0];
  },

  /**
   * Get all snapshots for a project
   * @param {number} projectId
   * @param {number} tenantId
   */
  async getByProject(projectId, tenantId) {
    const result = await db.query(
      `SELECT * FROM project_snapshots
       WHERE project_id = $1 AND tenant_id = $2
       ORDER BY snapshot_date ASC`,
      [projectId, tenantId]
    );
    return result.rows;
  },

  /**
   * Get snapshots within a date range
   * @param {number} projectId
   * @param {number} tenantId
   * @param {Date} startDate
   * @param {Date} endDate
   */
  async getByDateRange(projectId, tenantId, startDate, endDate) {
    const result = await db.query(
      `SELECT * FROM project_snapshots
       WHERE project_id = $1 AND tenant_id = $2
       AND snapshot_date >= $3 AND snapshot_date <= $4
       ORDER BY snapshot_date ASC`,
      [projectId, tenantId, startDate, endDate]
    );
    return result.rows;
  },

  /**
   * Check if snapshot exists for a project on a specific date
   * @param {number} projectId
   * @param {Date} snapshotDate
   */
  async exists(projectId, snapshotDate) {
    const result = await db.query(
      `SELECT id FROM project_snapshots
       WHERE project_id = $1 AND snapshot_date = $2`,
      [projectId, snapshotDate]
    );
    return result.rows.length > 0;
  },

  /**
   * Get latest snapshot for a project
   * @param {number} projectId
   * @param {number} tenantId
   */
  async getLatest(projectId, tenantId) {
    const result = await db.query(
      `SELECT * FROM project_snapshots
       WHERE project_id = $1 AND tenant_id = $2
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [projectId, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Delete old snapshots (for cleanup/archiving)
   * @param {number} projectId
   * @param {Date} beforeDate
   */
  async deleteBefore(projectId, beforeDate) {
    const result = await db.query(
      `DELETE FROM project_snapshots
       WHERE project_id = $1 AND snapshot_date < $2
       RETURNING id`,
      [projectId, beforeDate]
    );
    return result.rowCount;
  },
};

module.exports = ProjectSnapshot;
