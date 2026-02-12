const db = require('../config/database');

const ProposalTemplate = {
  /**
   * Create a new proposal template with sections
   */
  async create(data, tenantId, userId) {
    const {
      name,
      description,
      category,
      default_executive_summary,
      default_company_overview,
      default_terms_and_conditions,
      is_default = false,
      is_active = true,
      sections = []
    } = data;

    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // If this is marked as default, unmark all other templates
      if (is_default) {
        await client.query(
          'UPDATE proposal_templates SET is_default = false WHERE tenant_id = $1',
          [tenantId]
        );
      }

      // Create template
      const templateResult = await client.query(
        `INSERT INTO proposal_templates (
          tenant_id, name, description, category,
          default_executive_summary, default_company_overview,
          default_terms_and_conditions, is_default, is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          tenantId, name, description, category,
          default_executive_summary, default_company_overview,
          default_terms_and_conditions, is_default, is_active, userId
        ]
      );

      const template = templateResult.rows[0];

      // Create sections if provided
      if (sections.length > 0) {
        for (const section of sections) {
          await client.query(
            `INSERT INTO proposal_template_sections (
              template_id, section_type, title, content, display_order, is_required
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              template.id,
              section.section_type,
              section.title,
              section.content,
              section.display_order || 0,
              section.is_required || false
            ]
          );
        }
      }

      await client.query('COMMIT');

      // Fetch complete template with sections
      return await this.findByIdAndTenant(template.id, tenantId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Find all proposal templates by tenant
   */
  async findAllByTenant(tenantId, filters = {}) {
    let query = `
      SELECT t.*,
        COUNT(s.id) as section_count
      FROM proposal_templates t
      LEFT JOIN proposal_template_sections s ON s.template_id = t.id
      WHERE t.tenant_id = $1
    `;
    const params = [tenantId];

    if (filters.category) {
      params.push(filters.category);
      query += ` AND t.category = $${params.length}`;
    }

    if (filters.is_active !== undefined) {
      params.push(filters.is_active);
      query += ` AND t.is_active = $${params.length}`;
    }

    query += ` GROUP BY t.id ORDER BY t.is_default DESC, t.name ASC`;

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Find template by ID with sections
   */
  async findByIdAndTenant(id, tenantId) {
    const templateResult = await db.query(
      'SELECT * FROM proposal_templates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (templateResult.rows.length === 0) {
      return null;
    }

    const template = templateResult.rows[0];

    // Fetch sections
    const sectionsResult = await db.query(
      `SELECT * FROM proposal_template_sections
       WHERE template_id = $1
       ORDER BY display_order ASC, id ASC`,
      [id]
    );

    template.sections = sectionsResult.rows;
    return template;
  },

  /**
   * Get default template for tenant
   */
  async getDefault(tenantId) {
    const result = await db.query(
      'SELECT * FROM proposal_templates WHERE tenant_id = $1 AND is_default = true AND is_active = true',
      [tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return await this.findByIdAndTenant(result.rows[0].id, tenantId);
  },

  /**
   * Update a proposal template
   */
  async update(id, data, tenantId, userId) {
    const {
      name,
      description,
      category,
      default_executive_summary,
      default_company_overview,
      default_terms_and_conditions,
      is_default,
      is_active,
      sections
    } = data;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // If this is marked as default, unmark all other templates
      if (is_default) {
        await client.query(
          'UPDATE proposal_templates SET is_default = false WHERE tenant_id = $1 AND id != $2',
          [tenantId, id]
        );
      }

      // Update template
      const templateResult = await client.query(
        `UPDATE proposal_templates SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          category = COALESCE($3, category),
          default_executive_summary = COALESCE($4, default_executive_summary),
          default_company_overview = COALESCE($5, default_company_overview),
          default_terms_and_conditions = COALESCE($6, default_terms_and_conditions),
          is_default = COALESCE($7, is_default),
          is_active = COALESCE($8, is_active),
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $9 AND tenant_id = $10
         RETURNING *`,
        [
          name, description, category,
          default_executive_summary, default_company_overview,
          default_terms_and_conditions, is_default, is_active,
          id, tenantId
        ]
      );

      // Update sections if provided
      if (sections) {
        // Delete existing sections
        await client.query(
          'DELETE FROM proposal_template_sections WHERE template_id = $1',
          [id]
        );

        // Insert new sections
        for (const section of sections) {
          await client.query(
            `INSERT INTO proposal_template_sections (
              template_id, section_type, title, content, display_order, is_required
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              id,
              section.section_type,
              section.title,
              section.content,
              section.display_order || 0,
              section.is_required || false
            ]
          );
        }
      }

      await client.query('COMMIT');

      return await this.findByIdAndTenant(id, tenantId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Delete a proposal template
   */
  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM proposal_templates WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Get sections for a template
   */
  async getSections(templateId) {
    const result = await db.query(
      `SELECT * FROM proposal_template_sections
       WHERE template_id = $1
       ORDER BY display_order ASC, id ASC`,
      [templateId]
    );
    return result.rows;
  },

  /**
   * Get available categories
   */
  async getCategories(tenantId) {
    const result = await db.query(
      `SELECT DISTINCT category
       FROM proposal_templates
       WHERE tenant_id = $1 AND category IS NOT NULL
       ORDER BY category`,
      [tenantId]
    );
    return result.rows.map(row => row.category);
  }
};

module.exports = ProposalTemplate;
