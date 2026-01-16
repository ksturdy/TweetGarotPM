const db = require('../config/database');

const DailyReport = {
  async create({ projectId, reportDate, weather, temperature, workPerformed, materials, equipment, visitors, issues, createdBy }) {
    const result = await db.query(
      `INSERT INTO daily_reports (project_id, report_date, weather, temperature, work_performed, materials, equipment, visitors, issues, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [projectId, reportDate, weather, temperature, workPerformed, materials, equipment, visitors, issues, createdBy]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT dr.*,
              p.name as project_name, p.number as project_number,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM daily_reports dr
       JOIN projects p ON dr.project_id = p.id
       LEFT JOIN users u ON dr.created_by = u.id
       WHERE dr.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT dr.*, u.first_name || ' ' || u.last_name as created_by_name
      FROM daily_reports dr
      LEFT JOIN users u ON dr.created_by = u.id
      WHERE dr.project_id = $1
    `;
    const params = [projectId];

    if (filters.startDate) {
      params.push(filters.startDate);
      query += ` AND dr.report_date >= $${params.length}`;
    }

    if (filters.endDate) {
      params.push(filters.endDate);
      query += ` AND dr.report_date <= $${params.length}`;
    }

    query += ' ORDER BY dr.report_date DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async findByDate(projectId, reportDate) {
    const result = await db.query(
      `SELECT dr.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM daily_reports dr
       LEFT JOIN users u ON dr.created_by = u.id
       WHERE dr.project_id = $1 AND dr.report_date = $2`,
      [projectId, reportDate]
    );
    return result.rows[0];
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

    values.push(id);
    const result = await db.query(
      `UPDATE daily_reports SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM daily_reports WHERE id = $1', [id]);
  },
};

module.exports = DailyReport;
