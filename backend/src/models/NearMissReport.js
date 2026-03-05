const db = require('../config/database');

const NearMissReport = {
  async create({ projectId, tenantId, number, reportType, dateOfIncident, locationOnSite, description, correctiveAction, dateCorrected, reportedBy, notes, createdBy }) {
    const result = await db.query(
      `INSERT INTO near_miss_reports (project_id, tenant_id, number, report_type, date_of_incident, location_on_site, description, corrective_action, date_corrected, reported_by, notes, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
       RETURNING *`,
      [projectId, tenantId, number, reportType || 'near_miss', dateOfIncident, locationOnSite || null, description, correctiveAction || null, dateCorrected || null, reportedBy || null, notes || null, createdBy]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT r.*,
              p.name as project_name, p.number as project_number,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM near_miss_reports r
       JOIN projects p ON r.project_id = p.id
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT r.*,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM near_miss_reports r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.project_id = $1
    `;
    const params = [projectId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND r.status = $${params.length}`;
    }

    if (filters.report_type) {
      params.push(filters.report_type);
      query += ` AND r.report_type = $${params.length}`;
    }

    query += ' ORDER BY r.date_of_incident DESC, r.number DESC';

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
      `UPDATE near_miss_reports SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM near_miss_reports WHERE id = $1', [id]);
  },

  async submit(id) {
    const result = await db.query(
      `UPDATE near_miss_reports SET status = 'submitted', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  async getNextNumber(projectId) {
    const result = await db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 as next_number FROM near_miss_reports WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next_number;
  },
};

module.exports = NearMissReport;
