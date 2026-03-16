const db = require('../config/database');

const ProjectSystem = {
  async findByTakeoff(takeoffId, tenantId) {
    const result = await db.query(
      `SELECT ps.*, srv.name as service_name, srv.abbreviation as service_abbreviation, srv.service_category
       FROM project_systems ps
       LEFT JOIN piping_services srv ON ps.piping_service_id = srv.id
       WHERE ps.takeoff_id = $1 AND ps.tenant_id = $2
       ORDER BY ps.name`,
      [takeoffId, tenantId]
    );
    return result.rows;
  },

  async findById(id, tenantId) {
    const result = await db.query(
      `SELECT ps.*, srv.name as service_name, srv.abbreviation as service_abbreviation, srv.service_category
       FROM project_systems ps
       LEFT JOIN piping_services srv ON ps.piping_service_id = srv.id
       WHERE ps.id = $1 AND ps.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0] || null;
  },

  async create(takeoffId, tenantId, data) {
    const result = await db.query(
      `INSERT INTO project_systems (takeoff_id, tenant_id, name, abbreviation, piping_service_id, color)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [takeoffId, tenantId, data.name, data.abbreviation, data.piping_service_id || null, data.color || '#3b82f6']
    );
    return result.rows[0];
  },

  async update(id, tenantId, data) {
    const fields = [];
    const params = [id, tenantId];
    let paramIdx = 3;

    for (const field of ['name', 'abbreviation', 'piping_service_id', 'color']) {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${paramIdx++}`);
        params.push(data[field]);
      }
    }

    if (fields.length === 0) return this.findById(id, tenantId);

    const result = await db.query(
      `UPDATE project_systems SET ${fields.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      params
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    const result = await db.query(
      `DELETE FROM project_systems WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );
    return result.rows[0];
  },
};

module.exports = ProjectSystem;
