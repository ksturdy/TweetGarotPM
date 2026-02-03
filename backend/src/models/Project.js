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
      `SELECT p.*, e.first_name || ' ' || e.last_name as manager_name, d.name as department_name, d.department_number
       FROM projects p
       LEFT JOIN employees e ON p.manager_id = e.id
       LEFT JOIN departments d ON p.department_id = d.id
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
      `SELECT p.*, e.first_name || ' ' || e.last_name as manager_name, d.name as department_name, d.department_number
       FROM projects p
       LEFT JOIN employees e ON p.manager_id = e.id
       LEFT JOIN departments d ON p.department_id = d.id
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
      SELECT p.*, e.first_name || ' ' || e.last_name as manager_name, d.name as department_name, d.department_number
      FROM projects p
      LEFT JOIN employees e ON p.manager_id = e.id
      LEFT JOIN departments d ON p.department_id = d.id
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
      SELECT p.*, e.first_name || ' ' || e.last_name as manager_name, d.name as department_name, d.department_number
      FROM projects p
      LEFT JOIN employees e ON p.manager_id = e.id
      LEFT JOIN departments d ON p.department_id = d.id
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

    query += ' ORDER BY p.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
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
  async update(id, updates, tenantId) {
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
};

module.exports = Project;
