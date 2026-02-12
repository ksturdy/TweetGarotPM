const db = require('../config/database');

const CaseStudy = {
  /**
   * Create a new case study
   */
  async create(data, tenantId) {
    const {
      title,
      subtitle,
      project_id,
      customer_id,
      challenge,
      solution,
      results,
      executive_summary,
      cost_savings,
      timeline_improvement_days,
      quality_score,
      additional_metrics,
      market,
      construction_type,
      project_size,
      services_provided,
      created_by
    } = data;

    const result = await db.query(
      `INSERT INTO case_studies (
        title, subtitle, project_id, customer_id, challenge, solution, results,
        executive_summary, cost_savings, timeline_improvement_days, quality_score,
        additional_metrics, market, construction_type, project_size, services_provided,
        created_by, tenant_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        title, subtitle, project_id, customer_id, challenge, solution, results,
        executive_summary, cost_savings, timeline_improvement_days, quality_score,
        additional_metrics ? JSON.stringify(additional_metrics) : null,
        market, construction_type, project_size,
        services_provided, created_by, tenantId, 'draft'
      ]
    );
    return result.rows[0];
  },

  /**
   * Find case study by ID (global - use with caution)
   */
  async findById(id) {
    const result = await db.query(
      `SELECT cs.*,
              p.name as project_name,
              c.customer_owner as customer_name,
              CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
              CONCAT(r.first_name, ' ', r.last_name) as reviewed_by_name
       FROM case_studies cs
       LEFT JOIN projects p ON cs.project_id = p.id
       LEFT JOIN customers c ON cs.customer_id = c.id
       LEFT JOIN users u ON cs.created_by = u.id
       LEFT JOIN users r ON cs.reviewed_by = r.id
       WHERE cs.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  /**
   * Find case study by ID with tenant check (secure)
   */
  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      `SELECT cs.*,
              p.name as project_name,
              c.customer_owner as customer_name,
              CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
              CONCAT(r.first_name, ' ', r.last_name) as reviewed_by_name
       FROM case_studies cs
       LEFT JOIN projects p ON cs.project_id = p.id
       LEFT JOIN customers c ON cs.customer_id = c.id
       LEFT JOIN users u ON cs.created_by = u.id
       LEFT JOIN users r ON cs.reviewed_by = r.id
       WHERE cs.id = $1 AND cs.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Find all case studies within a tenant with optional filters
   */
  async findAllByTenant(tenantId, filters = {}) {
    let query = `
      SELECT cs.*,
             p.name as project_name,
             c.customer_owner as customer_name,
             CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
             (SELECT COUNT(*) FROM case_study_images WHERE case_study_id = cs.id) as image_count
      FROM case_studies cs
      LEFT JOIN projects p ON cs.project_id = p.id
      LEFT JOIN customers c ON cs.customer_id = c.id
      LEFT JOIN users u ON cs.created_by = u.id
      WHERE cs.tenant_id = $1
    `;
    const params = [tenantId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND cs.status = $${params.length}`;
    }

    if (filters.featured !== undefined) {
      params.push(filters.featured);
      query += ` AND cs.featured = $${params.length}`;
    }

    if (filters.market) {
      params.push(filters.market);
      query += ` AND cs.market = $${params.length}`;
    }

    if (filters.customer_id) {
      params.push(filters.customer_id);
      query += ` AND cs.customer_id = $${params.length}`;
    }

    if (filters.project_id) {
      params.push(filters.project_id);
      query += ` AND cs.project_id = $${params.length}`;
    }

    query += ' ORDER BY cs.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Update a case study
   */
  async update(id, data, tenantId) {
    const {
      title,
      subtitle,
      project_id,
      customer_id,
      challenge,
      solution,
      results,
      executive_summary,
      cost_savings,
      timeline_improvement_days,
      quality_score,
      additional_metrics,
      market,
      construction_type,
      project_size,
      services_provided,
      featured,
      display_order
    } = data;

    const result = await db.query(
      `UPDATE case_studies SET
        title = COALESCE($1, title),
        subtitle = COALESCE($2, subtitle),
        project_id = COALESCE($3, project_id),
        customer_id = COALESCE($4, customer_id),
        challenge = COALESCE($5, challenge),
        solution = COALESCE($6, solution),
        results = COALESCE($7, results),
        executive_summary = COALESCE($8, executive_summary),
        cost_savings = COALESCE($9, cost_savings),
        timeline_improvement_days = COALESCE($10, timeline_improvement_days),
        quality_score = COALESCE($11, quality_score),
        additional_metrics = COALESCE($12, additional_metrics),
        market = COALESCE($13, market),
        construction_type = COALESCE($14, construction_type),
        project_size = COALESCE($15, project_size),
        services_provided = COALESCE($16, services_provided),
        featured = COALESCE($17, featured),
        display_order = COALESCE($18, display_order),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $19 AND tenant_id = $20
       RETURNING *`,
      [
        title, subtitle, project_id, customer_id, challenge, solution, results,
        executive_summary, cost_savings, timeline_improvement_days, quality_score,
        additional_metrics ? JSON.stringify(additional_metrics) : null,
        market, construction_type, project_size, services_provided,
        featured, display_order, id, tenantId
      ]
    );
    return result.rows[0];
  },

  /**
   * Publish a case study (workflow action)
   */
  async publish(id, userId, tenantId) {
    const result = await db.query(
      `UPDATE case_studies SET
        status = 'published',
        reviewed_by = $1,
        published_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [userId, id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Archive a case study (workflow action)
   */
  async archive(id, tenantId) {
    const result = await db.query(
      `UPDATE case_studies SET
        status = 'archived',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Submit for review (workflow action)
   */
  async submitForReview(id, tenantId) {
    const result = await db.query(
      `UPDATE case_studies SET
        status = 'under_review',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Get featured case studies (for homepage/proposals)
   */
  async getFeatured(tenantId, limit = 6) {
    const result = await db.query(
      `SELECT cs.*,
              p.name as project_name,
              c.customer_owner as customer_name,
              (SELECT file_path FROM case_study_images
               WHERE case_study_id = cs.id AND is_hero_image = true
               LIMIT 1) as hero_image_path
       FROM case_studies cs
       LEFT JOIN projects p ON cs.project_id = p.id
       LEFT JOIN customers c ON cs.customer_id = c.id
       WHERE cs.tenant_id = $1
         AND cs.status = 'published'
         AND cs.featured = true
       ORDER BY cs.display_order NULLS LAST, cs.published_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );
    return result.rows;
  },

  /**
   * Get case studies for a specific project
   */
  async getByProject(projectId, tenantId) {
    const result = await db.query(
      `SELECT cs.*,
              c.customer_owner as customer_name,
              (SELECT file_path FROM case_study_images
               WHERE case_study_id = cs.id AND is_hero_image = true
               LIMIT 1) as hero_image_path
       FROM case_studies cs
       LEFT JOIN customers c ON cs.customer_id = c.id
       WHERE cs.project_id = $1 AND cs.tenant_id = $2
         AND cs.status = 'published'
       ORDER BY cs.published_at DESC`,
      [projectId, tenantId]
    );
    return result.rows;
  },

  /**
   * Delete a case study (cascades to images)
   */
  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM case_studies WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Count case studies by tenant (for limit checking)
   */
  async countByTenant(tenantId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM case_studies WHERE tenant_id = $1',
      [tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  }
};

module.exports = CaseStudy;
