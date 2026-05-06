const db = require('../config/database');

const ResumeTemplate = {
  async findAllByTenant(tenantId, filters = {}) {
    let query = `
      SELECT *
      FROM resume_templates
      WHERE tenant_id = $1
    `;
    const params = [tenantId];

    if (filters.is_active !== undefined) {
      params.push(filters.is_active);
      query += ` AND is_active = $${params.length}`;
    }

    query += ' ORDER BY is_default DESC, name ASC';
    const result = await db.query(query, params);
    return result.rows;
  },

  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      'SELECT * FROM resume_templates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0];
  },

  async getDefault(tenantId) {
    const result = await db.query(
      `SELECT * FROM resume_templates
       WHERE tenant_id = $1 AND is_default = TRUE AND is_active = TRUE
       LIMIT 1`,
      [tenantId]
    );
    return result.rows[0];
  },

  async create(data, tenantId) {
    const {
      name,
      description = null,
      template_key,
      page_size = 'letter',
      orientation = 'portrait',
      max_pages = 1,
      is_default = false,
      is_active = true,
      preview_image_path = null,
    } = data;

    const DEFAULT_SECTION_LIMITS = {
      summary_chars: 600,
      projects: 5,
      certifications: 6,
      skills: 12,
      languages: 4,
      hobbies: 6,
      references: 3,
    };
    const DEFAULT_LAYOUT_CONFIG = {
      show_photo: true,
      show_years_experience: true,
      sidebar_color: '#1e3a5f',
      sections: {
        contact: true,
        references: true,
        hobbies: true,
        summary: true,
        projects: true,
        education: true,
        skills: true,
        languages: true,
      },
    };

    const sectionLimits = data.section_limits == null
      ? JSON.stringify(DEFAULT_SECTION_LIMITS)
      : (typeof data.section_limits === 'string' ? data.section_limits : JSON.stringify(data.section_limits));
    const layoutConfig = data.layout_config == null
      ? JSON.stringify(DEFAULT_LAYOUT_CONFIG)
      : (typeof data.layout_config === 'string' ? data.layout_config : JSON.stringify(data.layout_config));

    const result = await db.query(
      `INSERT INTO resume_templates
        (tenant_id, name, description, template_key, page_size, orientation, max_pages,
         is_default, is_active, preview_image_path, section_limits, layout_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)
       RETURNING *`,
      [tenantId, name, description, template_key, page_size, orientation, max_pages,
        is_default, is_active, preview_image_path, sectionLimits, layoutConfig]
    );
    return result.rows[0];
  },

  async update(id, data, tenantId) {
    const existing = await this.findByIdAndTenant(id, tenantId);
    if (!existing) return null;

    const sectionLimits = data.section_limits === undefined
      ? null
      : (typeof data.section_limits === 'string' ? data.section_limits : JSON.stringify(data.section_limits));
    const layoutConfig = data.layout_config === undefined
      ? null
      : (typeof data.layout_config === 'string' ? data.layout_config : JSON.stringify(data.layout_config));

    const result = await db.query(
      `UPDATE resume_templates SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        page_size = COALESCE($3, page_size),
        orientation = COALESCE($4, orientation),
        max_pages = COALESCE($5, max_pages),
        is_active = COALESCE($6, is_active),
        preview_image_path = COALESCE($7, preview_image_path),
        section_limits = COALESCE($8::jsonb, section_limits),
        layout_config = COALESCE($9::jsonb, layout_config),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 AND tenant_id = $11
       RETURNING *`,
      [
        data.name ?? null,
        data.description ?? null,
        data.page_size ?? null,
        data.orientation ?? null,
        data.max_pages ?? null,
        data.is_active ?? null,
        data.preview_image_path ?? null,
        sectionLimits,
        layoutConfig,
        id,
        tenantId,
      ]
    );
    return result.rows[0];
  },

  /**
   * Set this template as default for the tenant. Atomically clears the previous default.
   */
  async setDefault(id, tenantId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE resume_templates SET is_default = FALSE WHERE tenant_id = $1',
        [tenantId]
      );
      const result = await client.query(
        `UPDATE resume_templates SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        [id, tenantId]
      );
      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM resume_templates WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    return result.rows[0];
  },
};

module.exports = ResumeTemplate;
