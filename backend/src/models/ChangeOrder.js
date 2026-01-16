const db = require('../config/database');

const ChangeOrder = {
  async create({ projectId, number, title, description, reason, amount, daysAdded, createdBy }) {
    const result = await db.query(
      `INSERT INTO change_orders (project_id, number, title, description, reason, amount, days_added, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
       RETURNING *`,
      [projectId, number, title, description, reason, amount || 0, daysAdded || 0, createdBy]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT co.*,
              p.name as project_name, p.number as project_number,
              u1.first_name || ' ' || u1.last_name as created_by_name,
              u2.first_name || ' ' || u2.last_name as approved_by_name
       FROM change_orders co
       JOIN projects p ON co.project_id = p.id
       LEFT JOIN users u1 ON co.created_by = u1.id
       LEFT JOIN users u2 ON co.approved_by = u2.id
       WHERE co.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT co.*,
             u1.first_name || ' ' || u1.last_name as created_by_name,
             u2.first_name || ' ' || u2.last_name as approved_by_name
      FROM change_orders co
      LEFT JOIN users u1 ON co.created_by = u1.id
      LEFT JOIN users u2 ON co.approved_by = u2.id
      WHERE co.project_id = $1
    `;
    const params = [projectId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND co.status = $${params.length}`;
    }

    query += ' ORDER BY co.number DESC';

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
      `UPDATE change_orders SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async approve(id, { approvedBy }) {
    const result = await db.query(
      `UPDATE change_orders SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [approvedBy, id]
    );
    return result.rows[0];
  },

  async reject(id, { rejectionReason }) {
    const result = await db.query(
      `UPDATE change_orders SET status = 'rejected', rejection_reason = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [rejectionReason, id]
    );
    return result.rows[0];
  },

  async getNextNumber(projectId) {
    const result = await db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 as next_number FROM change_orders WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next_number;
  },

  async getProjectTotals(projectId) {
    const result = await db.query(
      `SELECT
         COUNT(*) as total_count,
         COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
         COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0) as approved_amount,
         COALESCE(SUM(days_added) FILTER (WHERE status = 'approved'), 0) as approved_days
       FROM change_orders
       WHERE project_id = $1`,
      [projectId]
    );
    return result.rows[0];
  },
};

module.exports = ChangeOrder;
