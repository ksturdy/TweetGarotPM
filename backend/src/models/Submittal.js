const db = require('../config/database');

const Submittal = {
  async create({ projectId, number, specSection, description, subcontractor, dueDate, createdBy }) {
    const result = await db.query(
      `INSERT INTO submittals (project_id, number, spec_section, description, subcontractor, due_date, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [projectId, number, specSection, description, subcontractor, dueDate, createdBy]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT s.*,
              p.name as project_name, p.number as project_number,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM submittals s
       JOIN projects p ON s.project_id = p.id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT s.*, u.first_name || ' ' || u.last_name as created_by_name
      FROM submittals s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.project_id = $1
    `;
    const params = [projectId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND s.status = $${params.length}`;
    }

    if (filters.specSection) {
      params.push(filters.specSection);
      query += ` AND s.spec_section = $${params.length}`;
    }

    query += ' ORDER BY s.number DESC';

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

    values.push(id);
    const result = await db.query(
      `UPDATE submittals SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async review(id, { status, reviewNotes, reviewedBy }) {
    const result = await db.query(
      `UPDATE submittals SET status = $1, review_notes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, reviewNotes, reviewedBy, id]
    );
    return result.rows[0];
  },

  async getNextNumber(projectId) {
    const result = await db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 as next_number FROM submittals WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next_number;
  },
};

module.exports = Submittal;
