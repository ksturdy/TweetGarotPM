const db = require('../config/database');

const DrawingScaleCalibration = {
  async upsert({ tenantId, drawingId, pageNumber, x1, y1, x2, y2, realWorldValue, realWorldUnit, createdBy }) {
    const result = await db.query(
      `INSERT INTO drawing_scale_calibrations
         (tenant_id, drawing_id, page_number, x1, y1, x2, y2, real_world_value, real_world_unit, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (drawing_id, page_number)
       DO UPDATE SET
         x1 = EXCLUDED.x1,
         y1 = EXCLUDED.y1,
         x2 = EXCLUDED.x2,
         y2 = EXCLUDED.y2,
         real_world_value = EXCLUDED.real_world_value,
         real_world_unit  = EXCLUDED.real_world_unit,
         created_by       = EXCLUDED.created_by,
         created_at       = NOW()
       RETURNING *`,
      [tenantId, drawingId, pageNumber, x1, y1, x2, y2, realWorldValue, realWorldUnit || 'ft', createdBy]
    );
    return result.rows[0];
  },

  async findByDrawingPage(drawingId, pageNumber) {
    const result = await db.query(
      `SELECT * FROM drawing_scale_calibrations
       WHERE drawing_id = $1 AND page_number = $2`,
      [drawingId, pageNumber]
    );
    return result.rows[0] || null;
  },

  async delete(drawingId, pageNumber, tenantId) {
    await db.query(
      `DELETE FROM drawing_scale_calibrations
       WHERE drawing_id = $1 AND page_number = $2 AND tenant_id = $3`,
      [drawingId, pageNumber, tenantId]
    );
  },
};

module.exports = DrawingScaleCalibration;
