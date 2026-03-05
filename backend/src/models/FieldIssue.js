const db = require('../config/database');

const FieldIssue = {
  async create({ projectId, tenantId, number, title, description, priority, trade, location, notes, createdBy }) {
    const result = await db.query(
      `INSERT INTO field_issues (project_id, tenant_id, number, title, description, priority, trade, location, notes, created_by, status, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', 'field')
       RETURNING *`,
      [projectId, tenantId, number, title, description, priority || 'normal', trade || null, location || null, notes || null, createdBy]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT i.*,
              p.name as project_name, p.number as project_number,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM field_issues i
       JOIN projects p ON i.project_id = p.id
       LEFT JOIN users u ON i.created_by = u.id
       WHERE i.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT i.*,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM field_issues i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.project_id = $1
    `;
    const params = [projectId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND i.status = $${params.length}`;
    }

    if (filters.trade) {
      params.push(filters.trade);
      query += ` AND i.trade = $${params.length}`;
    }

    query += ' ORDER BY i.number DESC';

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
      `UPDATE field_issues SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM field_issues WHERE id = $1', [id]);
  },

  async submit(id) {
    const result = await db.query(
      `UPDATE field_issues SET status = 'submitted', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  async getNextNumber(projectId) {
    const result = await db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 as next_number FROM field_issues WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next_number;
  },
};

module.exports = FieldIssue;
