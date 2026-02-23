const db = require('../config/database');

const ResumeProject = {
  /**
   * Create a new resume project entry
   */
  async create(data, tenantId) {
    const {
      resume_id,
      project_id,
      project_name,
      project_role,
      customer_name,
      project_value,
      start_date,
      end_date,
      description,
      square_footage,
      location,
      display_order = 0
    } = data;

    const result = await db.query(
      `INSERT INTO resume_projects (
        resume_id, tenant_id, project_id, project_name, project_role,
        customer_name, project_value, start_date, end_date, description,
        square_footage, location, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        resume_id, tenantId, project_id, project_name, project_role,
        customer_name, project_value, start_date, end_date, description,
        square_footage, location, display_order
      ]
    );
    return result.rows[0];
  },

  /**
   * Find all projects for a resume
   */
  async findByResumeId(resumeId, tenantId) {
    const result = await db.query(
      `SELECT rp.*,
        p.name as db_project_name,
        p.number as project_number
       FROM resume_projects rp
       LEFT JOIN projects p ON rp.project_id = p.id
       WHERE rp.resume_id = $1 AND rp.tenant_id = $2
       ORDER BY rp.display_order ASC, rp.start_date DESC NULLS LAST`,
      [resumeId, tenantId]
    );
    return result.rows;
  },

  /**
   * Find single project by ID
   */
  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      'SELECT * FROM resume_projects WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Update a resume project entry
   */
  async update(id, data, tenantId) {
    const existing = await this.findByIdAndTenant(id, tenantId);
    if (!existing) return null;

    const {
      project_id,
      project_name,
      project_role,
      customer_name,
      project_value,
      start_date,
      end_date,
      description,
      square_footage,
      location,
      display_order
    } = data;

    const result = await db.query(
      `UPDATE resume_projects SET
        project_id = COALESCE($1, project_id),
        project_name = COALESCE($2, project_name),
        project_role = COALESCE($3, project_role),
        customer_name = COALESCE($4, customer_name),
        project_value = COALESCE($5, project_value),
        start_date = COALESCE($6, start_date),
        end_date = COALESCE($7, end_date),
        description = COALESCE($8, description),
        square_footage = COALESCE($9, square_footage),
        location = COALESCE($10, location),
        display_order = COALESCE($11, display_order),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 AND tenant_id = $13
       RETURNING *`,
      [
        project_id, project_name, project_role, customer_name,
        project_value, start_date, end_date, description,
        square_footage, location, display_order, id, tenantId
      ]
    );
    return result.rows[0];
  },

  /**
   * Delete a resume project entry
   */
  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM resume_projects WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Reorder projects for a resume
   * @param {number} resumeId - Resume ID
   * @param {number[]} projectIds - Array of project IDs in desired order
   * @param {number} tenantId - Tenant ID
   */
  async reorder(resumeId, projectIds, tenantId) {
    // Use a transaction to update all display orders atomically
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      for (let i = 0; i < projectIds.length; i++) {
        await client.query(
          `UPDATE resume_projects
           SET display_order = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND resume_id = $3 AND tenant_id = $4`,
          [i, projectIds[i], resumeId, tenantId]
        );
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};

module.exports = ResumeProject;
