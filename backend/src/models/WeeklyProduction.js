const db = require('../config/database');

function currentSunday() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // rewind to Sunday
  return d.toISOString().split('T')[0];
}

const WeeklyProduction = {
  /**
   * Return all labor phase schedule items for a project, with their weekly
   * qty entries and hour snapshots for the given date range.
   */
  async getWeeklyData(projectId, tenantId, fromDate, toDate) {
    const [itemsRes, entriesRes, snapshotsRes] = await Promise.all([
      db.query(
        `SELECT
           psi.id, psi.name, psi.row_number, psi.sort_order,
           psi.start_date, psi.end_date,
           psi.quantity, psi.quantity_installed, psi.quantity_uom,
           psi.total_est_hours, psi.total_est_cost,
           psi.total_jtd_hours, psi.total_jtd_cost,
           psi.percent_complete, psi.contour_type,
           psi.cost_types, psi.phase_code_ids,
           psi.use_manual_qty_values, psi.manual_monthly_qty,
           (SELECT string_agg(DISTINCT rtrim(trim(pc.phase), '- '), ', ' ORDER BY rtrim(trim(pc.phase), '- '))
            FROM vp_phase_codes pc WHERE pc.id = ANY(psi.phase_code_ids)) AS phase_code_display
         FROM phase_schedule_items psi
         WHERE psi.project_id = $1 AND psi.tenant_id = $2
           AND 1 = ANY(psi.cost_types)
         ORDER BY psi.sort_order, psi.row_number, psi.id`,
        [projectId, tenantId]
      ),
      db.query(
        `SELECT phase_schedule_item_id, week_ending, qty_installed, notes
         FROM phase_schedule_weekly_entries
         WHERE project_id = $1 AND tenant_id = $2
           AND week_ending BETWEEN $3 AND $4
         ORDER BY week_ending`,
        [projectId, tenantId, fromDate, toDate]
      ),
      db.query(
        `SELECT phase_schedule_item_id, week_ending, jtd_hours, jtd_cost
         FROM phase_code_hour_snapshots
         WHERE project_id = $1 AND tenant_id = $2
           AND week_ending BETWEEN $3 AND $4
         ORDER BY week_ending`,
        [projectId, tenantId, fromDate, toDate]
      ),
    ]);

    return {
      items: itemsRes.rows,
      entries: entriesRes.rows,
      snapshots: snapshotsRes.rows,
    };
  },

  /**
   * Upsert a single weekly entry and recalculate quantity_installed +
   * percent_complete on the parent phase_schedule_item.
   */
  async upsertEntry(itemId, weekEnding, qtyInstalled, tenantId, userId) {
    // Verify item belongs to this tenant and is a labor item
    const itemCheck = await db.query(
      `SELECT id, project_id, quantity FROM phase_schedule_items
       WHERE id = $1 AND tenant_id = $2 AND 1 = ANY(cost_types)`,
      [itemId, tenantId]
    );
    if (!itemCheck.rows[0]) throw Object.assign(new Error('Phase schedule item not found'), { status: 404 });

    const { project_id, quantity } = itemCheck.rows[0];

    await db.query(
      `INSERT INTO phase_schedule_weekly_entries
         (project_id, tenant_id, phase_schedule_item_id, week_ending, qty_installed, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (phase_schedule_item_id, week_ending)
       DO UPDATE SET qty_installed = EXCLUDED.qty_installed, updated_at = NOW()`,
      [project_id, tenantId, itemId, weekEnding, qtyInstalled, userId]
    );

    // Recalculate quantity_installed and percent_complete from all weekly entries
    await db.query(
      `UPDATE phase_schedule_items
       SET quantity_installed = (
             SELECT COALESCE(SUM(qty_installed), 0)
             FROM phase_schedule_weekly_entries
             WHERE phase_schedule_item_id = $1 AND tenant_id = $2
           ),
           percent_complete = CASE
             WHEN quantity > 0 THEN LEAST(
               (SELECT COALESCE(SUM(qty_installed), 0)
                FROM phase_schedule_weekly_entries
                WHERE phase_schedule_item_id = $1 AND tenant_id = $2)
               / quantity, 1.0
             )
             ELSE 0
           END,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [itemId, tenantId]
    );
  },

  /**
   * Bulk upsert entries (for paste operations).
   * rows: [{ itemId, weekEnding, qtyInstalled }]
   */
  async bulkUpsertEntries(rows, projectId, tenantId, userId) {
    if (!rows.length) return;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      for (const row of rows) {
        await client.query(
          `INSERT INTO phase_schedule_weekly_entries
             (project_id, tenant_id, phase_schedule_item_id, week_ending, qty_installed, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (phase_schedule_item_id, week_ending)
           DO UPDATE SET qty_installed = EXCLUDED.qty_installed, updated_at = NOW()`,
          [projectId, tenantId, row.itemId, row.weekEnding, row.qtyInstalled, userId]
        );
      }

      // Recalculate all affected items in one pass
      const itemIds = [...new Set(rows.map(r => r.itemId))];
      for (const itemId of itemIds) {
        await client.query(
          `UPDATE phase_schedule_items
           SET quantity_installed = (
                 SELECT COALESCE(SUM(qty_installed), 0)
                 FROM phase_schedule_weekly_entries
                 WHERE phase_schedule_item_id = $1 AND tenant_id = $2
               ),
               percent_complete = CASE
                 WHEN quantity > 0 THEN LEAST(
                   (SELECT COALESCE(SUM(qty_installed), 0)
                    FROM phase_schedule_weekly_entries
                    WHERE phase_schedule_item_id = $1 AND tenant_id = $2)
                   / quantity, 1.0
                 )
                 ELSE 0
               END,
               updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
          [itemId, tenantId]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Snapshot current jtd_hours / jtd_cost for all labor phase schedule items
   * belonging to a single project.
   */
  async snapshotProject(projectId, tenantId, weekEnding) {
    const we = weekEnding || currentSunday();

    const result = await db.query(
      `INSERT INTO phase_code_hour_snapshots
         (tenant_id, project_id, phase_schedule_item_id, week_ending, jtd_hours, jtd_cost)
       SELECT
         psi.tenant_id,
         psi.project_id,
         psi.id,
         $3,
         COALESCE(SUM(vpc.jtd_hours), psi.total_jtd_hours, 0),
         COALESCE(SUM(vpc.jtd_cost),  psi.total_jtd_cost,  0)
       FROM phase_schedule_items psi
       LEFT JOIN vp_phase_codes vpc
         ON vpc.id = ANY(psi.phase_code_ids) AND vpc.tenant_id = psi.tenant_id
       WHERE psi.project_id = $1 AND psi.tenant_id = $2
         AND 1 = ANY(psi.cost_types)
       GROUP BY psi.tenant_id, psi.project_id, psi.id, psi.total_jtd_hours, psi.total_jtd_cost
       ON CONFLICT (phase_schedule_item_id, week_ending)
       DO UPDATE SET
         jtd_hours         = EXCLUDED.jtd_hours,
         jtd_cost          = EXCLUDED.jtd_cost,
         snapshot_taken_at = NOW()`,
      [projectId, tenantId, we]
    );

    return result.rowCount;
  },

  /**
   * Snapshot all active projects across all tenants. Called by cron every Sunday at 11pm.
   */
  async snapshotAllTenants() {
    const Tenant = require('./Tenant');
    const Project = require('./Project');

    const we = currentSunday();
    const tenants = await Tenant.findAll();
    let total = 0;
    let errors = 0;

    for (const tenant of tenants) {
      if (!tenant.is_active) continue;
      try {
        const active = await Project.findAllByTenant(tenant.id, { status: 'active' });
        const open   = await Project.findAllByTenant(tenant.id, { status: 'Open' });
        const projectMap = new Map();
        [...active, ...open].forEach(p => projectMap.set(p.id, p));

        for (const project of projectMap.values()) {
          try {
            const n = await WeeklyProduction.snapshotProject(project.id, tenant.id, we);
            total += n;
          } catch (err) {
            errors++;
            console.error(`[PhaseSnapshot] Error on project ${project.id}:`, err.message);
          }
        }
      } catch (err) {
        console.error(`[PhaseSnapshot] Error on tenant ${tenant.id}:`, err.message);
      }
    }

    console.log(`[PhaseSnapshot] Done: ${total} rows upserted, ${errors} errors`);
    return { total, errors };
  },
};

module.exports = WeeklyProduction;
