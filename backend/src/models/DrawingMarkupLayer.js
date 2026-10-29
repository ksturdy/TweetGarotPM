const db = require('../config/database');

const DrawingMarkupLayer = {
  async create({ tenantId, drawingId, pageNumber, name, color, isPersonal, createdBy }) {
    const result = await db.query(
      `INSERT INTO drawing_markup_layers
         (tenant_id, drawing_id, page_number, name, color, is_personal, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, drawingId, pageNumber, name, color || '#FF0000', !!isPersonal, createdBy]
    );
    return result.rows[0];
  },

  async findByDrawingPage(drawingId, pageNumber, userId) {
    const result = await db.query(
      `SELECT * FROM drawing_markup_layers
       WHERE drawing_id = $1 AND page_number = $2
         AND (is_personal = false OR created_by = $3)
       ORDER BY created_at`,
      [drawingId, pageNumber, userId]
    );
    return result.rows;
  },

  async update(id, tenantId, updates) {
    const allowed = ['name', 'color', 'is_visible'];
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
    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);
    const result = await db.query(
      `UPDATE drawing_markup_layers SET ${fields.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id, tenantId, userId) {
    await db.query(
      `DELETE FROM drawing_markup_layers
       WHERE id = $1 AND tenant_id = $2 AND created_by = $3`,
      [id, tenantId, userId]
    );
  },
};

module.exports = DrawingMarkupLayer;
