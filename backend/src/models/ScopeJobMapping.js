const { pool } = require('../config/database');

const ScopeJobMapping = {
  async getByHistoricalProject(tenantId, historicalProjectId) {
    const result = await pool.query(
      `SELECT id, scope, vista_job, cached_est_cost, historical_project_id, live_project_id, created_at, updated_at
       FROM project_scope_job_mappings
       WHERE tenant_id = $1 AND historical_project_id = $2
       ORDER BY scope`,
      [tenantId, historicalProjectId]
    );
    return result.rows;
  },

  async getByLiveProject(tenantId, liveProjectId) {
    const result = await pool.query(
      `SELECT id, scope, vista_job, cached_est_cost, historical_project_id, live_project_id, created_at, updated_at
       FROM project_scope_job_mappings
       WHERE tenant_id = $1 AND live_project_id = $2
       ORDER BY scope`,
      [tenantId, liveProjectId]
    );
    return result.rows;
  },

  async upsert(tenantId, { historical_project_id, live_project_id, scope, vista_job, cached_est_cost, created_by }) {
    if (historical_project_id) {
      const result = await pool.query(
        `INSERT INTO project_scope_job_mappings
           (tenant_id, historical_project_id, scope, vista_job, cached_est_cost, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, historical_project_id, scope)
         DO UPDATE SET vista_job = EXCLUDED.vista_job,
                       cached_est_cost = EXCLUDED.cached_est_cost,
                       updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [tenantId, historical_project_id, scope, vista_job, cached_est_cost, created_by]
      );
      return result.rows[0];
    } else {
      const result = await pool.query(
        `INSERT INTO project_scope_job_mappings
           (tenant_id, live_project_id, scope, vista_job, cached_est_cost, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, live_project_id, scope)
         DO UPDATE SET vista_job = EXCLUDED.vista_job,
                       cached_est_cost = EXCLUDED.cached_est_cost,
                       updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [tenantId, live_project_id, scope, vista_job, cached_est_cost, created_by]
      );
      return result.rows[0];
    }
  },

  async delete(tenantId, id) {
    const result = await pool.query(
      `DELETE FROM project_scope_job_mappings WHERE tenant_id = $1 AND id = $2 RETURNING id`,
      [tenantId, id]
    );
    return result.rowCount > 0;
  },

  // Bulk fetch for all comparables in a budget — used by the generate endpoint
  async getForComparables(tenantId, comparables) {
    if (!comparables || comparables.length === 0) return [];

    const histIds = comparables.filter(c => c.source !== 'project' && c.id > 0).map(c => c.id);
    const liveIds = comparables.filter(c => c.source === 'project' && c.id > 0).map(c => c.id);

    const parts = [];
    const params = [tenantId];

    if (histIds.length > 0) {
      params.push(histIds);
      parts.push(`(historical_project_id = ANY($${params.length}))`);
    }
    if (liveIds.length > 0) {
      params.push(liveIds);
      parts.push(`(live_project_id = ANY($${params.length}))`);
    }
    if (parts.length === 0) return [];

    const result = await pool.query(
      `SELECT id, scope, vista_job, cached_est_cost, historical_project_id, live_project_id
       FROM project_scope_job_mappings
       WHERE tenant_id = $1 AND (${parts.join(' OR ')})`,
      params
    );
    return result.rows;
  },
};

module.exports = ScopeJobMapping;
