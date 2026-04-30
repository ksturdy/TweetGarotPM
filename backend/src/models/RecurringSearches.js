const pool = require('../config/database');

const RecurringSearches = {
  /**
   * Create a new recurring search
   */
  async create(data, userId, tenantId) {
    const { name, description, criteria, is_active = true } = data;

    const result = await pool.query(
      `INSERT INTO opportunity_recurring_searches
        (name, description, criteria, is_active, created_by, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description || null, JSON.stringify(criteria), is_active, userId, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Get all recurring searches for a tenant
   */
  async findAllByTenant(tenantId, activeOnly = false) {
    const query = activeOnly
      ? `SELECT rs.*,
               u.first_name || ' ' || u.last_name as created_by_name
         FROM opportunity_recurring_searches rs
         LEFT JOIN users u ON rs.created_by = u.id
         WHERE rs.tenant_id = $1 AND rs.is_active = true
         ORDER BY rs.created_at DESC`
      : `SELECT rs.*,
               u.first_name || ' ' || u.last_name as created_by_name
         FROM opportunity_recurring_searches rs
         LEFT JOIN users u ON rs.created_by = u.id
         WHERE rs.tenant_id = $1
         ORDER BY rs.created_at DESC`;

    const result = await pool.query(query, [tenantId]);
    return result.rows;
  },

  /**
   * Get a single recurring search by ID
   */
  async findById(id, tenantId) {
    const result = await pool.query(
      `SELECT rs.*,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM opportunity_recurring_searches rs
       LEFT JOIN users u ON rs.created_by = u.id
       WHERE rs.id = $1 AND rs.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Update a recurring search
   */
  async update(id, data, tenantId) {
    const { name, description, criteria, is_active } = data;

    const sets = [];
    const params = [];
    let paramCount = 1;

    if (name !== undefined) {
      sets.push(`name = $${paramCount++}`);
      params.push(name);
    }
    if (description !== undefined) {
      sets.push(`description = $${paramCount++}`);
      params.push(description);
    }
    if (criteria !== undefined) {
      sets.push(`criteria = $${paramCount++}`);
      params.push(JSON.stringify(criteria));
    }
    if (is_active !== undefined) {
      sets.push(`is_active = $${paramCount++}`);
      params.push(is_active);
    }

    if (sets.length === 0) return null;

    sets.push(`updated_at = NOW()`);
    params.push(id, tenantId);

    const result = await pool.query(
      `UPDATE opportunity_recurring_searches
       SET ${sets.join(', ')}
       WHERE id = $${paramCount++} AND tenant_id = $${paramCount}
       RETURNING *`,
      params
    );

    return result.rows[0];
  },

  /**
   * Update last run stats after executing a search
   */
  async updateLastRun(id, resultCount, resultValue, results, tenantId) {
    const result = await pool.query(
      `UPDATE opportunity_recurring_searches
       SET last_run_at = NOW(),
           last_result_count = $2,
           last_result_value = $3,
           last_results = $4,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $5
       RETURNING *`,
      [id, resultCount, resultValue, JSON.stringify(results), tenantId]
    );
    return result.rows[0];
  },

  /**
   * Delete a recurring search
   */
  async delete(id, tenantId) {
    const result = await pool.query(
      `DELETE FROM opportunity_recurring_searches
       WHERE id = $1 AND tenant_id = $2
       RETURNING id`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Toggle active status
   */
  async toggleActive(id, tenantId) {
    const result = await pool.query(
      `UPDATE opportunity_recurring_searches
       SET is_active = NOT is_active,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Duplicate a recurring search
   */
  async duplicate(id, userId, tenantId, newName) {
    const original = await this.findById(id, tenantId);
    if (!original) return null;

    const result = await pool.query(
      `INSERT INTO opportunity_recurring_searches
        (name, description, criteria, is_active, created_by, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        newName || `${original.name} (Copy)`,
        original.description,
        JSON.stringify(original.criteria),
        original.is_active,
        userId,
        tenantId
      ]
    );
    return result.rows[0];
  },
};

module.exports = RecurringSearches;
