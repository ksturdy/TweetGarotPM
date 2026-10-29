const db = require('../config/database');

const DrawingMeasurement = {
  async create({ tenantId, drawingId, pageNumber, measureType, points, computedValue, unit, label, createdBy }) {
    const result = await db.query(
      `INSERT INTO drawing_measurements
         (tenant_id, drawing_id, page_number, measure_type, points, computed_value, unit, label, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tenantId, drawingId, pageNumber, measureType, JSON.stringify(points),
       computedValue || null, unit || null, label || null, createdBy]
    );
    return result.rows[0];
  },

  async findByDrawingPage(drawingId, pageNumber) {
    const result = await db.query(
      `SELECT * FROM drawing_measurements
       WHERE drawing_id = $1 AND page_number = $2
       ORDER BY created_at`,
      [drawingId, pageNumber]
    );
    return result.rows;
  },

  async update(id, tenantId, updates) {
    const fields = [];
    const values = [];
    let i = 1;
    if (updates.points !== undefined) {
      fields.push(`points = $${i++}`);
      values.push(JSON.stringify(updates.points));
    }
    if (updates.computed_value !== undefined) {
      fields.push(`computed_value = $${i++}`);
      values.push(updates.computed_value);
    }
    if (updates.unit !== undefined) {
      fields.push(`unit = $${i++}`);
      values.push(updates.unit);
    }
    if (updates.label !== undefined) {
      fields.push(`label = $${i++}`);
      values.push(updates.label);
    }
    if (fields.length === 0) return null;
    fields.push('updated_at = NOW()');
    values.push(id, tenantId);
    const result = await db.query(
      `UPDATE drawing_measurements SET ${fields.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id, tenantId) {
    await db.query(
      'DELETE FROM drawing_measurements WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
  },
};

module.exports = DrawingMeasurement;
