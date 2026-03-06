const db = require('../config/database');

const DailyReport = {
  async create({ projectId, reportDate, weather, temperature, workPerformed, materials, equipment, visitors, issues, delayHours, delayReason, safetyIncidents, safetyNotes, createdBy }) {
    const result = await db.query(
      `INSERT INTO daily_reports (project_id, report_date, weather, temperature, work_performed, materials, equipment, visitors, issues, delay_hours, delay_reason, safety_incidents, safety_notes, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft')
       RETURNING *`,
      [projectId, reportDate, weather, temperature, workPerformed, materials, equipment, visitors, issues, delayHours || 0, delayReason, safetyIncidents || 0, safetyNotes, createdBy]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT dr.*,
              p.name as project_name, p.number as project_number,
              u.first_name || ' ' || u.last_name as created_by_name,
              ru.first_name || ' ' || ru.last_name as revised_by_name
       FROM daily_reports dr
       JOIN projects p ON dr.project_id = p.id
       LEFT JOIN users u ON dr.created_by = u.id
       LEFT JOIN users ru ON dr.revised_by = ru.id
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

  async submit(id, { submittedBy }) {
    const result = await db.query(
      `UPDATE daily_reports SET status = 'submitted', submitted_by = $1, submitted_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [submittedBy, id]
    );
    return result.rows[0];
  },

  async approve(id, { approvedBy }) {
    const result = await db.query(
      `UPDATE daily_reports SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approvedBy, id]
    );
    return result.rows[0];
  },

  async revise(id, { revisedBy, revisionNotes }) {
    const result = await db.query(
      `UPDATE daily_reports
       SET status = 'revision',
           revision_notes = $1,
           revised_by = $2,
           revised_at = NOW(),
           revision_count = COALESCE(revision_count, 0) + 1,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [revisionNotes || null, revisedBy, id]
    );
    return result.rows[0];
  },

  // Crew tracking
  async addCrew(dailyReportId, { trade, foreman, crewSize, hoursWorked, workDescription }) {
    const result = await db.query(
      `INSERT INTO daily_report_crews (daily_report_id, trade, foreman, crew_size, hours_worked, work_description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [dailyReportId, trade, foreman, crewSize || 0, hoursWorked || 0, workDescription]
    );
    return result.rows[0];
  },

  async updateCrew(crewId, updates) {
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

    if (fields.length === 0) return null;

    values.push(crewId);
    const result = await db.query(
      `UPDATE daily_report_crews SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async deleteCrew(crewId) {
    await db.query('DELETE FROM daily_report_crews WHERE id = $1', [crewId]);
  },

  async getCrews(dailyReportId) {
    const result = await db.query(
      'SELECT * FROM daily_report_crews WHERE daily_report_id = $1 ORDER BY trade, id',
      [dailyReportId]
    );
    return result.rows;
  },
};

module.exports = DailyReport;
