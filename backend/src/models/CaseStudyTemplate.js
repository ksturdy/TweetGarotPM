const db = require('../config/database');

const CaseStudyTemplate = {
  async create(data, tenantId, userId) {
    const {
      name,
      description,
      category,
      layout_config,
      color_scheme = 'default',
      show_logo = true,
      show_images = true,
      show_metrics = true,
      is_default = false,
      is_active = true
    } = data;

    // If this is marked as default, unmark all other templates
    if (is_default) {
      await db.query(
        'UPDATE case_study_templates SET is_default = false WHERE tenant_id = $1',
        [tenantId]
      );
    }

    const result = await db.query(
      `INSERT INTO case_study_templates (
        tenant_id, name, description, category, layout_config,
        color_scheme, show_logo, show_images, show_metrics,
        is_default, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        tenantId, name, description, category,
        JSON.stringify(layout_config || {}),
        color_scheme, show_logo, show_images, show_metrics,
        is_default, is_active, userId
      ]
    );
    return result.rows[0];
  },

  async findAllByTenant(tenantId, filters = {}) {
    let query = `
      SELECT * FROM case_study_templates
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

    query += ` ORDER BY is_default DESC, name ASC`;

    const result = await db.query(query, params);
    return result.rows;
  },

  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      'SELECT * FROM case_study_templates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0] || null;
  },

  async getDefault(tenantId) {
    const result = await db.query(
      'SELECT * FROM case_study_templates WHERE tenant_id = $1 AND is_default = true AND is_active = true',
      [tenantId]
    );
    return result.rows[0] || null;
  },

  async update(id, data, tenantId) {
    const {
      name,
      description,
      category,
      layout_config,
      color_scheme,
      show_logo,
      show_images,
      show_metrics,
      is_default,
      is_active
    } = data;

    // If this is marked as default, unmark all other templates
    if (is_default) {
      await db.query(
        'UPDATE case_study_templates SET is_default = false WHERE tenant_id = $1 AND id != $2',
        [tenantId, id]
      );
    }

    const result = await db.query(
      `UPDATE case_study_templates SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        layout_config = COALESCE($4, layout_config),
        color_scheme = COALESCE($5, color_scheme),
        show_logo = COALESCE($6, show_logo),
        show_images = COALESCE($7, show_images),
        show_metrics = COALESCE($8, show_metrics),
        is_default = COALESCE($9, is_default),
        is_active = COALESCE($10, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 AND tenant_id = $12
       RETURNING *`,
      [
        name, description, category,
        layout_config ? JSON.stringify(layout_config) : null,
        color_scheme, show_logo, show_images, show_metrics,
        is_default, is_active, id, tenantId
      ]
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM case_study_templates WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    return result.rows[0];
  },

  async getCategories(tenantId) {
    const result = await db.query(
      `SELECT DISTINCT category
       FROM case_study_templates
       WHERE tenant_id = $1 AND category IS NOT NULL
       ORDER BY category`,
      [tenantId]
    );
    return result.rows.map(row => row.category);
  }
};

module.exports = CaseStudyTemplate;
