const db = require('../config/database');

const ProductivityRate = {
  /**
   * Look up productivity rate for a fitting type, join type, and pipe diameter.
   * Falls back: exact join_type match → any available rate for that fitting+diameter.
   */
  async lookup(tenantId, fittingType, joinType, pipeDiameter) {
    // Try exact match first (with specific join type)
    if (joinType) {
      const result = await db.query(
        `SELECT hours_per_unit, unit FROM piping_productivity_rates
         WHERE tenant_id = $1 AND fitting_type = $2 AND join_type = $3 AND pipe_diameter = $4
         LIMIT 1`,
        [tenantId, fittingType, joinType, pipeDiameter]
      );
      if (result.rows.length > 0) return result.rows[0];
    }

    // Fallback: any available rate for this fitting + diameter
    const result = await db.query(
      `SELECT hours_per_unit, unit FROM piping_productivity_rates
       WHERE tenant_id = $1 AND fitting_type = $2 AND pipe_diameter = $3
       ORDER BY join_type NULLS FIRST
       LIMIT 1`,
      [tenantId, fittingType, pipeDiameter]
    );
    return result.rows[0] || null;
  },

  /**
   * Get all productivity rates for a tenant, optionally filtered.
   */
  async findAll(tenantId, filters = {}) {
    let query = `SELECT * FROM piping_productivity_rates WHERE tenant_id = $1`;
    const params = [tenantId];
    let paramCount = 2;

    if (filters.fitting_type) {
      params.push(filters.fitting_type);
      query += ` AND fitting_type = $${paramCount++}`;
    }

    if (filters.join_type) {
      params.push(filters.join_type);
      query += ` AND join_type = $${paramCount++}`;
    }

    query += ' ORDER BY fitting_type, join_type, pipe_diameter';
    const result = await db.query(query, params);
    return result.rows;
  },
};

module.exports = ProductivityRate;
