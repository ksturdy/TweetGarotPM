const db = require('../config/database');

const ProjectLaborRate = {
  async list(projectId, tenantId) {
    const result = await db.query(
      `SELECT id, project_id, tenant_id, label, billable_rate, sort_order, created_at, updated_at
       FROM project_labor_rates
       WHERE project_id = $1 AND tenant_id = $2
       ORDER BY sort_order, id`,
      [projectId, tenantId]
    );
    return result.rows;
  },

  async create({ projectId, tenantId, label, billableRate, sortOrder }) {
    const result = await db.query(
      `INSERT INTO project_labor_rates (project_id, tenant_id, label, billable_rate, sort_order)
       VALUES ($1, $2, $3, $4, COALESCE($5, 0))
       RETURNING *`,
      [projectId, tenantId, label, billableRate || 0, sortOrder]
    );
    return result.rows[0];
  },

  async update(id, tenantId, { label, billableRate, sortOrder }) {
    const fields = [];
    const values = [];
    let i = 1;
    if (label !== undefined)        { fields.push(`label = $${i++}`);         values.push(label); }
    if (billableRate !== undefined) { fields.push(`billable_rate = $${i++}`); values.push(billableRate); }
    if (sortOrder !== undefined)    { fields.push(`sort_order = $${i++}`);    values.push(sortOrder); }
    if (fields.length === 0) return null;
    values.push(id, tenantId);
    const result = await db.query(
      `UPDATE project_labor_rates SET ${fields.join(', ')}
       WHERE id = $${i} AND tenant_id = $${i + 1}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    const result = await db.query(
      `DELETE FROM project_labor_rates WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );
    return result.rows[0];
  },
};

module.exports = ProjectLaborRate;
