const { pool } = require('../config/database');

const SECTIONS = ['project_info', 'labor', 'material', 'subcontracts', 'rental', 'mep_equipment', 'general_conditions', 'orientation'];

const PreJobChecklist = {
  async getByProjectId(projectId, tenantId) {
    const result = await pool.query(
      'SELECT * FROM pre_job_checklist WHERE project_id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );
    return result.rows[0] || null;
  },

  async updateSection(projectId, tenantId, section, data) {
    if (!SECTIONS.includes(section)) {
      throw new Error(`Invalid section: ${section}`);
    }
    const result = await pool.query(
      `INSERT INTO pre_job_checklist (tenant_id, project_id, ${section})
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, project_id) DO UPDATE
         SET ${section} = $3, updated_at = NOW()
       RETURNING *`,
      [tenantId, projectId, JSON.stringify(data)]
    );
    return result.rows[0];
  },
};

module.exports = PreJobChecklist;
