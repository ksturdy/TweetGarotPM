const db = require('../config/database');

const SmFittingOrder = {
  async create({ projectId, tenantId, number, title, description, priority, requiredByDate, drawingNumber, drawingRevision, specSection, locationOnSite, materialType, materialGauge, ductType, dimensions, insulationRequired, insulationSpec, linerRequired, quantity, unit, costCode, phaseCode, notes, createdBy }) {
    const result = await db.query(
      `INSERT INTO sm_fitting_orders (project_id, tenant_id, number, title, description, priority, required_by_date, drawing_number, drawing_revision, spec_section, location_on_site, material_type, material_gauge, duct_type, dimensions, insulation_required, insulation_spec, liner_required, quantity, unit, cost_code, phase_code, notes, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, 'draft')
       RETURNING *`,
      [projectId, tenantId, number, title, description, priority || 'normal', requiredByDate || null, drawingNumber, drawingRevision, specSection, locationOnSite, materialType, materialGauge, ductType, dimensions, insulationRequired || false, insulationSpec, linerRequired || false, quantity || 1, unit, costCode, phaseCode, notes, createdBy]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT o.*,
              p.name as project_name, p.number as project_number,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM sm_fitting_orders o
       JOIN projects p ON o.project_id = p.id
       LEFT JOIN users u ON o.created_by = u.id
       WHERE o.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT o.*,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM sm_fitting_orders o
      LEFT JOIN users u ON o.created_by = u.id
      WHERE o.project_id = $1
    `;
    const params = [projectId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND o.status = $${params.length}`;
    }

    if (filters.priority) {
      params.push(filters.priority);
      query += ` AND o.priority = $${params.length}`;
    }

    query += ' ORDER BY o.number DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbField} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await db.query(
      `UPDATE sm_fitting_orders SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM sm_fitting_orders WHERE id = $1', [id]);
  },

  async getNextNumber(projectId) {
    const result = await db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 as next_number FROM sm_fitting_orders WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next_number;
  },

  async getProjectStats(projectId) {
    const result = await db.query(
      `SELECT
         COUNT(*) as total_count,
         COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
         COUNT(*) FILTER (WHERE status = 'submitted') as submitted_count,
         COUNT(*) FILTER (WHERE status = 'in_fabrication') as in_fabrication_count,
         COUNT(*) FILTER (WHERE status = 'ready') as ready_count,
         COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
         COUNT(*) FILTER (WHERE status = 'installed') as installed_count
       FROM sm_fitting_orders
       WHERE project_id = $1`,
      [projectId]
    );
    return result.rows[0];
  },
};

module.exports = SmFittingOrder;
