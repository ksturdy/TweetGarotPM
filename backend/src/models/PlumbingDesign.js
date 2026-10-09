const db = require('../config/database');

const PlumbingDesign = {
  async create({ tenantId, name, hubNumber, projectId, createdBy, designData }) {
    const result = await db.query(
      `INSERT INTO plumbing_designs (tenant_id, name, hub_number, project_id, created_by, design_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, name, hubNumber || null, projectId || null, createdBy, JSON.stringify(designData || {})]
    );
    return result.rows[0];
  },

  async findByTenant(tenantId) {
    const result = await db.query(
      `SELECT d.*,
              u.first_name || ' ' || u.last_name AS created_by_name,
              p.name AS project_name, p.number AS project_number
       FROM plumbing_designs d
       LEFT JOIN users u ON d.created_by = u.id
       LEFT JOIN projects p ON d.project_id = p.id
       WHERE d.tenant_id = $1
       ORDER BY d.updated_at DESC`,
      [tenantId]
    );
    return result.rows;
  },

  async findById(id, tenantId) {
    const result = await db.query(
      `SELECT d.*,
              u.first_name || ' ' || u.last_name AS created_by_name,
              p.name AS project_name, p.number AS project_number
       FROM plumbing_designs d
       LEFT JOIN users u ON d.created_by = u.id
       LEFT JOIN projects p ON d.project_id = p.id
       WHERE d.id = $1 AND d.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async update(id, tenantId, { name, hubNumber, projectId, designData }) {
    const result = await db.query(
      `UPDATE plumbing_designs
       SET name = COALESCE($3, name),
           hub_number = COALESCE($4, hub_number),
           project_id = $5,
           design_data = COALESCE($6, design_data),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId, name, hubNumber || null, projectId || null, designData ? JSON.stringify(designData) : null]
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    const result = await db.query(
      `DELETE FROM plumbing_designs WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );
    return result.rows[0];
  },
};

module.exports = PlumbingDesign;
