const pool = require('../config/database');

const SavedSearches = {
  async create(data, userId, tenantId) {
    const { name, criteria, results, summary, leadCount, totalEstimatedValue } = data;

    const result = await pool.query(
      `INSERT INTO opportunity_saved_searches
        (name, criteria, results, summary, lead_count, total_estimated_value, created_by, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name,
        JSON.stringify(criteria),
        JSON.stringify(results),
        JSON.stringify(summary),
        leadCount || 0,
        totalEstimatedValue || 0,
        userId,
        tenantId
      ]
    );
    return result.rows[0];
  },

  async findAllByTenant(tenantId) {
    const result = await pool.query(
      `SELECT
         oss.id, oss.name, oss.criteria, oss.lead_count, oss.total_estimated_value,
         oss.created_by, oss.created_at,
         u.first_name || ' ' || u.last_name as created_by_name
       FROM opportunity_saved_searches oss
       LEFT JOIN users u ON oss.created_by = u.id
       WHERE oss.tenant_id = $1
       ORDER BY oss.created_at DESC`,
      [tenantId]
    );
    return result.rows;
  },

  async findById(id, tenantId) {
    const result = await pool.query(
      `SELECT oss.*,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM opportunity_saved_searches oss
       LEFT JOIN users u ON oss.created_by = u.id
       WHERE oss.id = $1 AND oss.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    const result = await pool.query(
      `DELETE FROM opportunity_saved_searches
       WHERE id = $1 AND tenant_id = $2
       RETURNING id`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async deleteMany(ids, tenantId) {
    if (!ids || ids.length === 0) return [];
    const result = await pool.query(
      `DELETE FROM opportunity_saved_searches
       WHERE id = ANY($1::int[]) AND tenant_id = $2
       RETURNING id`,
      [ids, tenantId]
    );
    return result.rows;
  }
};

module.exports = SavedSearches;
