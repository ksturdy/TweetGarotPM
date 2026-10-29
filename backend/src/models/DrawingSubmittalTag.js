const db = require('../config/database');

const DrawingSubmittalTag = {
  async create({ tenantId, drawingId, pageNumber, x, y, width, height, submittalId, createdBy }) {
    const result = await db.query(
      `INSERT INTO drawing_submittal_tags
         (tenant_id, drawing_id, page_number, x, y, width, height, submittal_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tenantId, drawingId, pageNumber, x, y, width, height, submittalId || null, createdBy]
    );
    return result.rows[0];
  },

  async findByDrawingPage(drawingId, pageNumber) {
    const result = await db.query(
      `SELECT t.*,
              s.name         AS submittal_name,
              s.status       AS submittal_status,
              s.submittal_number
       FROM drawing_submittal_tags t
       LEFT JOIN submittals s ON t.submittal_id = s.id
       WHERE t.drawing_id = $1 AND t.page_number = $2
       ORDER BY t.created_at`,
      [drawingId, pageNumber]
    );
    return result.rows;
  },

  async update(id, tenantId, updates) {
    const allowed = ['x', 'y', 'width', 'height', 'submittal_id'];
    const fields = [];
    const values = [];
    let i = 1;
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${i++}`);
        values.push(updates[key]);
      }
    }
    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');
    values.push(id, tenantId);
    const result = await db.query(
      `UPDATE drawing_submittal_tags SET ${fields.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    await db.query(
      'DELETE FROM drawing_submittal_tags WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
  },
};

module.exports = DrawingSubmittalTag;
