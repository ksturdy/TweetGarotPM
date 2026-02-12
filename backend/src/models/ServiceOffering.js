const db = require('../config/database');

const ServiceOffering = {
  /**
   * Create a new service offering
   */
  async create(data, tenantId) {
    const {
      name,
      description,
      category,
      pricing_model,
      typical_duration_days,
      icon_name,
      display_order,
      is_active = true
    } = data;

    const result = await db.query(
      `INSERT INTO service_offerings (
        name, description, category, pricing_model, typical_duration_days,
        icon_name, display_order, is_active, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        name, description, category, pricing_model, typical_duration_days,
        icon_name, display_order, is_active, tenantId
      ]
    );
    return result.rows[0];
  },

  /**
   * Find all service offerings by tenant with optional filters
   */
  async findAllByTenant(tenantId, filters = {}) {
    let query = `
      SELECT *
      FROM service_offerings
      WHERE tenant_id = $1
    `;
    const params = [tenantId];

    if (filters.category) {
      params.push(filters.category);
      query += ` AND category = $${params.length}`;
    }

    if (filters.is_active !== undefined) {
      params.push(filters.is_active);
      query += ` AND is_active = $${params.length}`;
    }

    query += ' ORDER BY display_order NULLS LAST, name ASC';

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Find service offering by ID and tenant
   */
  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      'SELECT * FROM service_offerings WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Update a service offering
   */
  async update(id, data, tenantId) {
    const {
      name,
      description,
      category,
      pricing_model,
      typical_duration_days,
      icon_name,
      display_order,
      is_active
    } = data;

    const result = await db.query(
      `UPDATE service_offerings SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        pricing_model = COALESCE($4, pricing_model),
        typical_duration_days = COALESCE($5, typical_duration_days),
        icon_name = COALESCE($6, icon_name),
        display_order = COALESCE($7, display_order),
        is_active = COALESCE($8, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND tenant_id = $10
       RETURNING *`,
      [
        name, description, category, pricing_model, typical_duration_days,
        icon_name, display_order, is_active, id, tenantId
      ]
    );
    return result.rows[0];
  },

  /**
   * Delete a service offering
   * Note: Should check if used in proposals before deleting
   */
  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM service_offerings WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Check if service offering is used in any proposals
   * (For future use when proposals module is built)
   */
  async isUsedInProposals(id) {
    // Placeholder for when proposal_service_offerings table exists
    // const result = await db.query(
    //   'SELECT COUNT(*) as count FROM proposal_service_offerings WHERE service_offering_id = $1',
    //   [id]
    // );
    // return parseInt(result.rows[0].count, 10) > 0;
    return false; // For now, always allow deletion
  },

  /**
   * Reorder service offerings
   */
  async reorder(updates, tenantId) {
    // updates is an array of { id, display_order }
    const promises = updates.map(({ id, display_order }) =>
      db.query(
        'UPDATE service_offerings SET display_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
        [display_order, id, tenantId]
      )
    );
    await Promise.all(promises);
    return true;
  },

  /**
   * Get categories used in service offerings
   */
  async getCategories(tenantId) {
    const result = await db.query(
      `SELECT DISTINCT category
       FROM service_offerings
       WHERE tenant_id = $1 AND category IS NOT NULL
       ORDER BY category`,
      [tenantId]
    );
    return result.rows.map(row => row.category);
  }
};

module.exports = ServiceOffering;
