const db = require('../config/database');

const RFI = {
  async create({ projectId, number, subject, question, priority, dueDate, assignedTo, createdBy }) {
    const result = await db.query(
      `INSERT INTO rfis (project_id, number, subject, question, priority, due_date, assigned_to, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
       RETURNING *`,
      [projectId, number, subject, question, priority || 'normal', dueDate, assignedTo, createdBy]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT r.*,
              p.name as project_name, p.number as project_number,
              u1.first_name || ' ' || u1.last_name as assigned_to_name,
              u2.first_name || ' ' || u2.last_name as created_by_name,
              u3.first_name || ' ' || u3.last_name as ball_in_court_name
       FROM rfis r
       JOIN projects p ON r.project_id = p.id
       LEFT JOIN users u1 ON r.assigned_to = u1.id
       LEFT JOIN users u2 ON r.created_by = u2.id
       LEFT JOIN users u3 ON r.ball_in_court = u3.id
       WHERE r.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT r.*,
             u1.first_name || ' ' || u1.last_name as assigned_to_name,
             u2.first_name || ' ' || u2.last_name as created_by_name,
             u3.first_name || ' ' || u3.last_name as ball_in_court_name
      FROM rfis r
      LEFT JOIN users u1 ON r.assigned_to = u1.id
      LEFT JOIN users u2 ON r.created_by = u2.id
      LEFT JOIN users u3 ON r.ball_in_court = u3.id
      WHERE r.project_id = $1
    `;
    const params = [projectId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND r.status = $${params.length}`;
    }

    query += ' ORDER BY r.number DESC';

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
      `UPDATE rfis SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async respond(id, { response, respondedBy }) {
    const result = await db.query(
      `UPDATE rfis SET response = $1, responded_by = $2, responded_at = NOW(), status = 'answered', updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [response, respondedBy, id]
    );
    return result.rows[0];
  },

  async getNextNumber(projectId) {
    const result = await db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 as next_number FROM rfis WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next_number;
  },
};

module.exports = RFI;
