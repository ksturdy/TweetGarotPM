const pool = require('../config/database');

class TraceoverMeasurement {
  // ─── Find all measurements for a document ───
  static async findByDocument(documentId) {
    const result = await pool.query(
      'SELECT * FROM traceover_measurements WHERE document_id = $1 ORDER BY page_number, created_at',
      [documentId]
    );
    return result.rows;
  }

  // ─── Find measurements for a specific page ───
  static async findByDocumentPage(documentId, pageNumber) {
    const result = await pool.query(
      'SELECT * FROM traceover_measurements WHERE document_id = $1 AND page_number = $2 ORDER BY created_at',
      [documentId, pageNumber]
    );
    return result.rows;
  }

  // ─── Find by ID ───
  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM traceover_measurements WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  // ─── Create ───
  static async create(data) {
    const result = await pool.query(
      `INSERT INTO traceover_measurements (document_id, page_number, measurement_type, points, label, color, pixel_value, scaled_value, unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.document_id, data.page_number,
        data.measurement_type || 'linear',
        JSON.stringify(data.points || []),
        data.label || '', data.color || '#3b82f6',
        data.pixel_value || 0, data.scaled_value || 0,
        data.unit || 'ft',
      ]
    );
    return result.rows[0];
  }

  // ─── Update ───
  static async update(id, data) {
    const allowedFields = ['measurement_type', 'points', 'label', 'color', 'pixel_value', 'scaled_value', 'unit'];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(field === 'points' ? JSON.stringify(data[field]) : data[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE traceover_measurements SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  // ─── Delete ───
  static async delete(id) {
    const result = await pool.query(
      'DELETE FROM traceover_measurements WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // ─── Delete all measurements for a document page ───
  static async deleteByDocumentPage(documentId, pageNumber) {
    const result = await pool.query(
      'DELETE FROM traceover_measurements WHERE document_id = $1 AND page_number = $2 RETURNING *',
      [documentId, pageNumber]
    );
    return result.rows;
  }
}

module.exports = TraceoverMeasurement;
