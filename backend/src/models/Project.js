const db = require('../config/database');

const Project = {
  /**
   * Create a new project
   * @param {Object} projectData - Project data including tenantId
   */
  async create({ name, number, client, address, startDate, endDate, status, description, market, managerId, tenantId }) {
    const result = await db.query(
      `INSERT INTO projects (name, number, client, address, start_date, end_date, status, description, market, manager_id, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [name, number, client, address, startDate, endDate, status || 'active', description, market, managerId, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Find project by ID (global - use with caution)
   */
  async findById(id) {
    const result = await db.query(
      `SELECT p.*, e.first_name || ' ' || e.last_name as manager_name, d.name as department_name, d.department_number,
              COALESCE(c.name, c.customer_owner, p.client) as customer_name, COALESCE(oc.name, oc.customer_owner) as owner_name,
              vc.ship_address, vc.ship_city, vc.ship_state, vc.ship_zip,
              vc.projected_revenue, vc.projected_cost, vc.actual_cost,
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
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  /**
   * Find project by ID with tenant check (secure)
   */
  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      `SELECT p.*, e.first_name || ' ' || e.last_name as manager_name,
              COALESCE(d.department_number, vd.department_number) as department_number,
              COALESCE(d.name, vd.name) as department_name,
              COALESCE(c.name, c.customer_owner, p.client) as customer_name, COALESCE(oc.name, oc.customer_owner) as owner_name,
              vc.ship_address, vc.ship_city, vc.ship_state, vc.ship_zip,
              vc.projected_revenue, vc.projected_cost, vc.actual_cost,
              COALESCE(vc.contract_amount, p.contract_value) as contract_value,
              CASE WHEN COALESCE(vc.gross_profit_percent, p.gross_margin_percent) >= 0.995
                        AND p.override_gm_percent IS NOT NULL
                   THEN p.override_gm_percent
                   ELSE COALESCE(vc.gross_profit_percent, p.gross_margin_percent)
              END as gross_margin_percent,
              (COALESCE(vc.gross_profit_percent, p.gross_margin_percent) >= 0.995
               AND p.override_gm_percent IS NOT NULL) as gm_overridden,
              COALESCE(vc.backlog, p.backlog) as backlog,
              COALESCE(p.market, vc.primary_market) as market,
              COALESCE(p.start_date, vc.start_month::date) as start_date,
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
       LEFT JOIN departments vd ON vc.linked_department_id = vd.id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Find all projects (global - admin only)
   */
  async findAll(filters = {}) {
    let query = `
      SELECT p.*, e.first_name || ' ' || e.last_name as manager_name,
             COALESCE(d.name, vd.name) as department_name,
             COALESCE(d.department_number, vd.department_number) as department_number,
             COALESCE(c.name, c.customer_owner, p.client) as customer_name, COALESCE(oc.name, oc.customer_owner) as owner_name,
             vc.ship_address, vc.ship_city, vc.ship_state, vc.ship_zip,
             vc.projected_revenue, vc.projected_cost, vc.actual_cost,
             COALESCE(vc.contract_amount, p.contract_value) as contract_value,
             CASE WHEN COALESCE(vc.gross_profit_percent, p.gross_margin_percent) >= 0.995
                       AND p.override_gm_percent IS NOT NULL
                  THEN p.override_gm_percent
                  ELSE COALESCE(vc.gross_profit_percent, p.gross_margin_percent)
             END as gross_margin_percent,
             (COALESCE(vc.gross_profit_percent, p.gross_margin_percent) >= 0.995
              AND p.override_gm_percent IS NOT NULL) as gm_overridden,
             COALESCE(vc.backlog, p.backlog) as backlog,
             COALESCE(NULLIF(p.market, ''), vc.primary_market) as market,
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
      LEFT JOIN departments vd ON vc.linked_department_id = vd.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND p.status = $${params.length}`;
    }

    if (filters.managerId) {
      params.push(filters.managerId);
      query += ` AND p.manager_id = $${params.length}`;
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Find all projects within a tenant
   */
  async findAllByTenant(tenantId, filters = {}) {
    let query = `
      SELECT p.*, e.first_name || ' ' || e.last_name as manager_name,
             COALESCE(d.name, vd.name) as department_name,
             COALESCE(d.department_number, vd.department_number) as department_number,
             COALESCE(c.name, c.customer_owner, p.client) as customer_name, COALESCE(oc.name, oc.customer_owner) as owner_name,
             vc.ship_address, vc.ship_city, vc.ship_state, vc.ship_zip,
             vc.projected_revenue, vc.projected_cost, vc.actual_cost,
             COALESCE(vc.contract_amount, p.contract_value) as contract_value,
             CASE WHEN COALESCE(vc.gross_profit_percent, p.gross_margin_percent) >= 0.995
                       AND p.override_gm_percent IS NOT NULL
                  THEN p.override_gm_percent
                  ELSE COALESCE(vc.gross_profit_percent, p.gross_margin_percent)
             END as gross_margin_percent,
             (COALESCE(vc.gross_profit_percent, p.gross_margin_percent) >= 0.995
              AND p.override_gm_percent IS NOT NULL) as gm_overridden,
             COALESCE(vc.backlog, p.backlog) as backlog,
             COALESCE(NULLIF(p.market, ''), vc.primary_market) as market,
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
      LEFT JOIN departments vd ON vc.linked_department_id = vd.id
      WHERE p.tenant_id = $1
    `;
    const params = [tenantId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND p.status = $${params.length}`;
    }

    if (filters.managerId) {
      params.push(filters.managerId);
      query += ` AND p.manager_id = $${params.length}`;
    }

    if (filters.projectIds && filters.projectIds.length > 0) {
      params.push(filters.projectIds);
      query += ` AND p.id = ANY($${params.length})`;
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Find projects with geocoded coordinates for map display
   */
  async findMapLocations(tenantId, filters = {}) {
    let query = `
      SELECT p.id, p.name, p.number, p.status, p.market,
             p.latitude::float, p.longitude::float,
             p.address, p.start_date,
             e.first_name || ' ' || e.last_name as manager_name,
             COALESCE(c.name, c.customer_owner, p.client) as customer_name,
             COALESCE(vc.contract_amount, p.contract_value) as contract_value,
             vc.ship_city, vc.ship_state,
             d.name as department_name
      FROM projects p
      LEFT JOIN employees e ON p.manager_id = e.id
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      WHERE p.tenant_id = $1
        AND p.latitude IS NOT NULL
        AND p.longitude IS NOT NULL
    `;
    const params = [tenantId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND p.status = $${params.length}`;
    }
    if (filters.managerId) {
      params.push(filters.managerId);
      query += ` AND p.manager_id = $${params.length}`;
    }
    if (filters.market) {
      params.push(filters.market);
      query += ` AND p.market = $${params.length}`;
    }

    query += ' ORDER BY p.name';
    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Find projects missing geocoding data (for batch geocoding)
   */
  async findUngeocoded(tenantId) {
    const result = await db.query(`
      SELECT p.id, p.address,
             vc.ship_address, vc.ship_city, vc.ship_state, vc.ship_zip
      FROM projects p
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      WHERE p.tenant_id = $1
        AND p.latitude IS NULL
        AND (vc.ship_city IS NOT NULL OR (p.address IS NOT NULL AND p.address != ''))
    `, [tenantId]);
    return result.rows;
  },

  /**
   * Find projects that have a street address but may need re-geocoding
   */
  async findNeedsRegeocoding(tenantId) {
    const result = await db.query(`
      SELECT p.id, p.address,
             vc.ship_address, vc.ship_city, vc.ship_state, vc.ship_zip
      FROM projects p
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      WHERE p.tenant_id = $1
        AND p.latitude IS NOT NULL
        AND vc.ship_address IS NOT NULL AND vc.ship_address != ''
    `, [tenantId]);
    return result.rows;
  },

  /**
   * Update geocoding data for a project
   */
  async updateGeocode(id, lat, lng) {
    await db.query(
      'UPDATE projects SET latitude = $1, longitude = $2, geocoded_at = NOW() WHERE id = $3',
      [lat, lng, id]
    );
  },

  /**
   * Count projects in a tenant (for limit checking)
   */
  async countByTenant(tenantId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM projects WHERE tenant_id = $1',
      [tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Update project (with tenant check)
   */
  async update(id, updates, tenantId, userId = null) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbField} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (userId) {
      fields.push(`updated_by = $${paramCount}`);
      values.push(userId);
      paramCount++;
    }

    values.push(id);
    values.push(tenantId);

    const result = await db.query(
      `UPDATE projects SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  /**
   * Delete project (with tenant check)
   */
  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM projects WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    return result.rows.length > 0;
  },

  /**
   * Bulk-apply GM override to all projects where the current GM% is ~100%
   * @param {number} tenantId
   * @param {number} overridePercent - decimal value (e.g. 0.165 for 16.5%)
   * @returns {number} count of updated rows
   */
  async applyGmOverride(tenantId, overridePercent) {
    const result = await db.query(`
      UPDATE projects p
      SET override_gm_percent = $2, updated_at = NOW()
      FROM (
        SELECT p2.id
        FROM projects p2
        LEFT JOIN vp_contracts vc ON vc.linked_project_id = p2.id
        WHERE p2.tenant_id = $1
          AND COALESCE(vc.gross_profit_percent, p2.gross_margin_percent) >= 0.995
          AND p2.status NOT IN ('completed', 'cancelled', 'Hard-Closed')
      ) sub
      WHERE p.id = sub.id
    `, [tenantId, overridePercent]);
    return result.rowCount;
  },

  /**
   * Clear all GM overrides for a tenant
   */
  async clearGmOverrides(tenantId) {
    const result = await db.query(`
      UPDATE projects SET override_gm_percent = NULL, updated_at = NOW()
      WHERE tenant_id = $1 AND override_gm_percent IS NOT NULL
    `, [tenantId]);
    return result.rowCount;
  },

  /**
   * Count projects with active GM overrides (where real GM is still ~100%)
   */
  async countGmOverrides(tenantId) {
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM projects p
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      WHERE p.tenant_id = $1
        AND p.override_gm_percent IS NOT NULL
        AND COALESCE(vc.gross_profit_percent, p.gross_margin_percent) >= 0.995
    `, [tenantId]);
    return parseInt(result.rows[0].count, 10);
  },
};

module.exports = Project;
