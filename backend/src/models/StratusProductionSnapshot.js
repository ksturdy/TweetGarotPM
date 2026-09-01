const db = require('../config/database');

const StratusProductionSnapshot = {
  // Called after every Stratus import. Aggregates weld inches by phase from the
  // import, joins with vp_phase_codes for current JTD labor hours, and upserts
  // one row per phase into stratus_production_snapshots.
  async captureSnapshot(projectId, tenantId, importId) {
    // Aggregate weld data by effective phase code from the import
    const weldResult = await db.query(
      `SELECT
         COALESCE(part_field_phase_code, part_shop_phase_code) AS phase_code,
         COALESCE(SUM(weld_inches_complete), 0) AS weld_inches_complete,
         COALESCE(SUM(shop_weld_inches), 0)     AS shop_weld_inches,
         COALESCE(SUM(field_weld_inches), 0)    AS field_weld_inches
       FROM stratus_parts
       WHERE import_id = $1 AND tenant_id = $2
         AND COALESCE(part_field_phase_code, part_shop_phase_code) IS NOT NULL
       GROUP BY COALESCE(part_field_phase_code, part_shop_phase_code)`,
      [importId, tenantId]
    );

    if (weldResult.rows.length === 0) return { captured: 0 };

    // Pull current JTD labor hours from Vista by phase for this project.
    // Vista stores phase codes with a trailing dash (e.g. "45-305-700-");
    // strip it so they match Stratus phase codes ("45-305-700").
    const hoursResult = await db.query(
      `SELECT RTRIM(phase, '-') AS phase, COALESCE(SUM(jtd_hours), 0) AS jtd_hours, COALESCE(SUM(jtd_cost), 0) AS jtd_cost
       FROM vp_phase_codes
       WHERE linked_project_id = $1 AND tenant_id = $2 AND cost_type = 1
       GROUP BY RTRIM(phase, '-')`,
      [projectId, tenantId]
    );
    const hoursMap = {};
    for (const r of hoursResult.rows) hoursMap[r.phase] = r;

    // Use today's date as the snapshot date (the upload date = week-end date)
    const snapshotDate = new Date().toISOString().slice(0, 10);
    const now = new Date();

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of weldResult.rows) {
        const hrs = hoursMap[row.phase_code];
        await client.query(
          `INSERT INTO stratus_production_snapshots
             (tenant_id, project_id, snapshot_date, import_id, phase_code,
              weld_inches_complete, shop_weld_inches, field_weld_inches,
              jtd_hours, jtd_cost, hours_refreshed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (project_id, snapshot_date, phase_code) DO UPDATE SET
             import_id             = EXCLUDED.import_id,
             weld_inches_complete  = EXCLUDED.weld_inches_complete,
             shop_weld_inches      = EXCLUDED.shop_weld_inches,
             field_weld_inches     = EXCLUDED.field_weld_inches,
             jtd_hours             = EXCLUDED.jtd_hours,
             jtd_cost              = EXCLUDED.jtd_cost,
             hours_refreshed_at    = EXCLUDED.hours_refreshed_at`,
          [
            tenantId, projectId, snapshotDate, importId, row.phase_code,
            row.weld_inches_complete, row.shop_weld_inches, row.field_weld_inches,
            hrs ? hrs.jtd_hours : null,
            hrs ? hrs.jtd_cost  : null,
            now,
          ]
        );
      }
      await client.query('COMMIT');
      return { captured: weldResult.rows.length, snapshot_date: snapshotDate };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Called after Vista phase codes are re-imported. Re-pulls JTD hours for
  // every project that has snapshots in the past 10 weeks so production rates
  // auto-correct once payroll posts mid-week.
  async refreshHoursForTenant(tenantId) {
    // Find all projects with recent snapshots
    const projects = await db.query(
      `SELECT DISTINCT project_id FROM stratus_production_snapshots
       WHERE tenant_id = $1 AND snapshot_date >= CURRENT_DATE - INTERVAL '10 weeks'`,
      [tenantId]
    );
    let totalUpdated = 0;
    for (const { project_id } of projects.rows) {
      const updated = await this.refreshHoursForProject(project_id, tenantId);
      totalUpdated += updated;
    }
    return totalUpdated;
  },

  async refreshHoursForProject(projectId, tenantId) {
    const hoursResult = await db.query(
      `SELECT RTRIM(phase, '-') AS phase, COALESCE(SUM(jtd_hours), 0) AS jtd_hours, COALESCE(SUM(jtd_cost), 0) AS jtd_cost
       FROM vp_phase_codes
       WHERE linked_project_id = $1 AND tenant_id = $2 AND cost_type = 1
       GROUP BY RTRIM(phase, '-')`,
      [projectId, tenantId]
    );
    if (hoursResult.rows.length === 0) return 0;

    const hoursMap = {};
    for (const r of hoursResult.rows) hoursMap[r.phase] = r;

    const snapshots = await db.query(
      `SELECT DISTINCT phase_code FROM stratus_production_snapshots
       WHERE project_id = $1 AND tenant_id = $2
         AND snapshot_date >= CURRENT_DATE - INTERVAL '10 weeks'`,
      [projectId, tenantId]
    );

    const now = new Date();
    let updated = 0;
    for (const { phase_code } of snapshots.rows) {
      const hrs = hoursMap[phase_code];
      if (!hrs) continue;
      const result = await db.query(
        `UPDATE stratus_production_snapshots
         SET jtd_hours = $1, jtd_cost = $2, hours_refreshed_at = $3
         WHERE project_id = $4 AND tenant_id = $5 AND phase_code = $6
           AND snapshot_date >= CURRENT_DATE - INTERVAL '10 weeks'`,
        [hrs.jtd_hours, hrs.jtd_cost, now, projectId, tenantId, phase_code]
      );
      updated += result.rowCount;
    }
    return updated;
  },

  // Returns all snapshots for a project, grouped into weekly buckets.
  // Shape: [{ snapshot_date, hours_refreshed_at, phases: [...] }]
  async getAll(projectId, tenantId) {
    const result = await db.query(
      `SELECT snapshot_date, phase_code,
              weld_inches_complete, shop_weld_inches, field_weld_inches,
              jtd_hours, jtd_cost, hours_refreshed_at
       FROM stratus_production_snapshots
       WHERE project_id = $1 AND tenant_id = $2
       ORDER BY snapshot_date ASC, phase_code ASC`,
      [projectId, tenantId]
    );

    // Group by snapshot_date
    const byDate = {};
    for (const row of result.rows) {
      const d = row.snapshot_date.toISOString ? row.snapshot_date.toISOString().slice(0, 10) : String(row.snapshot_date).slice(0, 10);
      if (!byDate[d]) byDate[d] = { snapshot_date: d, hours_refreshed_at: row.hours_refreshed_at, phases: [] };
      const wi = parseFloat(row.weld_inches_complete) || 0;
      const hrs = parseFloat(row.jtd_hours) || 0;
      byDate[d].phases.push({
        phase_code: row.phase_code,
        weld_inches_complete: wi,
        shop_weld_inches: parseFloat(row.shop_weld_inches) || 0,
        field_weld_inches: parseFloat(row.field_weld_inches) || 0,
        jtd_hours: hrs || null,
        jtd_cost: parseFloat(row.jtd_cost) || null,
        production_rate: hrs > 0 ? parseFloat((wi / hrs).toFixed(4)) : null,
      });
      // Keep most recent hours_refreshed_at for the snapshot group
      if (row.hours_refreshed_at && (!byDate[d].hours_refreshed_at || row.hours_refreshed_at > byDate[d].hours_refreshed_at)) {
        byDate[d].hours_refreshed_at = row.hours_refreshed_at;
      }
    }

    return Object.values(byDate);
  },

  // Returns the latest snapshot per phase with delta vs. the prior snapshot.
  async getLatestSummary(projectId, tenantId) {
    const all = await this.getAll(projectId, tenantId);
    if (all.length === 0) return { snapshot_date: null, hours_refreshed_at: null, phases: [] };

    const latest = all[all.length - 1];
    const prior  = all.length > 1 ? all[all.length - 2] : null;

    const priorMap = {};
    if (prior) {
      for (const p of prior.phases) priorMap[p.phase_code] = p;
    }

    const phases = latest.phases.map((p) => {
      const prev = priorMap[p.phase_code];
      return {
        ...p,
        prior_rate:          prev?.production_rate ?? null,
        rate_delta:          p.production_rate != null && prev?.production_rate != null
                               ? parseFloat((p.production_rate - prev.production_rate).toFixed(4))
                               : null,
        weld_inches_delta:   prev != null ? p.weld_inches_complete - prev.weld_inches_complete : null,
      };
    });

    return { snapshot_date: latest.snapshot_date, hours_refreshed_at: latest.hours_refreshed_at, phases };
  },
};

module.exports = StratusProductionSnapshot;
