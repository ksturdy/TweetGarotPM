const db = require('../config/database');

const DrawingMarkup = {
  async create({ tenantId, layerId, drawingId, pageNumber, toolType, geometry, style, createdBy }) {
    const result = await db.query(
      `INSERT INTO drawing_markups
         (tenant_id, layer_id, drawing_id, page_number, tool_type, geometry, style, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [tenantId, layerId, drawingId, pageNumber, toolType,
       JSON.stringify(geometry), JSON.stringify(style || {}), createdBy]
    );
    return result.rows[0];
  },

  async findByDrawingPage(drawingId, pageNumber, userId) {
    const result = await db.query(
      `SELECT m.* FROM drawing_markups m
       JOIN drawing_markup_layers l ON m.layer_id = l.id
       WHERE m.drawing_id = $1 AND m.page_number = $2
         AND (l.is_personal = false OR l.created_by = $3)
         AND l.is_visible = true
       ORDER BY m.created_at`,
      [drawingId, pageNumber, userId]
    );
    return result.rows;
  },

  async update(id, tenantId, updates) {
    const fields = [];
    const values = [];
    let i = 1;
    if (updates.geometry !== undefined) {
      fields.push(`geometry = $${i++}`);
      values.push(JSON.stringify(updates.geometry));
    }
    if (updates.style !== undefined) {
      fields.push(`style = $${i++}`);
      values.push(JSON.stringify(updates.style));
    }
    if (updates.layer_id !== undefined) {
      fields.push(`layer_id = $${i++}`);
      values.push(updates.layer_id);
    }
    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');
    values.push(id, tenantId);
    const result = await db.query(
      `UPDATE drawing_markups SET ${fields.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    await db.query(
      'DELETE FROM drawing_markups WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
  },

  async bulkDelete(ids, tenantId) {
    if (!ids || ids.length === 0) return;
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await db.query(
      `DELETE FROM drawing_markups WHERE id IN (${placeholders}) AND tenant_id = $${ids.length + 1}`,
      [...ids, tenantId]
    );
  },
};

module.exports = DrawingMarkup;
