const db = require('../config/database');

const Project = {
  async create({ name, number, client, address, startDate, endDate, status, description, market, managerId }) {
    const result = await db.query(
      `INSERT INTO projects (name, number, client, address, start_date, end_date, status, description, market, manager_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [name, number, client, address, startDate, endDate, status || 'active', description, market, managerId]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT p.*, u.first_name || ' ' || u.last_name as manager_name
       FROM projects p
       LEFT JOIN users u ON p.manager_id = u.id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findAll(filters = {}) {
    let query = `
      SELECT p.*, u.first_name || ' ' || u.last_name as manager_name
      FROM projects p
      LEFT JOIN users u ON p.manager_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND p.status = $${params.length}`;
    }

    if (filters.managerId) {
      params.push(filters.managerId);
      query += ` AND p.manager_id = $${params.length}`;
    }

    query += ' ORDER BY p.created_at DESC';

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
      `UPDATE projects SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM projects WHERE id = $1', [id]);
  },
};

module.exports = Project;
