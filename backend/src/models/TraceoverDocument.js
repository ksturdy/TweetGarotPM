const pool = require('../config/database');

class TraceoverDocument {
  // ─── Find all documents for a takeoff ───
  static async findByTakeoff(takeoffId) {
    const result = await pool.query(
      `SELECT td.*, u.name as uploaded_by_name,
              (SELECT COUNT(*) FROM traceover_runs tr WHERE tr.document_id = td.id) as run_count,
              (SELECT COUNT(*) FROM traceover_calibrations tc WHERE tc.document_id = td.id) as calibrated_pages
       FROM traceover_documents td
       LEFT JOIN users u ON td.uploaded_by = u.id
       WHERE td.takeoff_id = $1
       ORDER BY td.created_at DESC`,
      [takeoffId]
    );
    return result.rows;
  }

  // ─── Find by ID with page metadata ───
  static async findById(id) {
    const docResult = await pool.query(
      `SELECT td.*, u.name as uploaded_by_name
       FROM traceover_documents td
       LEFT JOIN users u ON td.uploaded_by = u.id
       WHERE td.id = $1`,
      [id]
    );
    if (docResult.rows.length === 0) return null;

    const doc = docResult.rows[0];

    // Attach page metadata
    const pagesResult = await pool.query(
      `SELECT * FROM traceover_page_metadata WHERE document_id = $1 ORDER BY page_number`,
      [id]
    );
    doc.pages = pagesResult.rows;

    // Attach calibrations
    const calResult = await pool.query(
      `SELECT * FROM traceover_calibrations WHERE document_id = $1 ORDER BY page_number`,
      [id]
    );
    doc.calibrations = calResult.rows;

    return doc;
  }

  // ─── Create ───
  static async create({ tenantId, takeoffId, fileName, originalName, storageKey, mimeType, fileSize, pageCount, uploadedBy }) {
    const result = await pool.query(
      `INSERT INTO traceover_documents (tenant_id, takeoff_id, file_name, original_name, storage_key, mime_type, file_size, page_count, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tenantId, takeoffId, fileName, originalName, storageKey, mimeType || 'application/pdf', fileSize || 0, pageCount || 0, uploadedBy]
    );
    return result.rows[0];
  }

  // ─── Update (page count, metadata) ───
  static async update(id, data) {
    const allowedFields = ['file_name', 'page_count'];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(data[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE traceover_documents SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  // ─── Delete ───
  static async delete(id) {
    const result = await pool.query(
      'DELETE FROM traceover_documents WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // ─── Page Metadata ───
  static async upsertPageMetadata(documentId, pageNumber, data) {
    const result = await pool.query(
      `INSERT INTO traceover_page_metadata (document_id, page_number, name, drawing_number, level, area, revision)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (document_id, page_number) DO UPDATE SET
         name = EXCLUDED.name,
         drawing_number = EXCLUDED.drawing_number,
         level = EXCLUDED.level,
         area = EXCLUDED.area,
         revision = EXCLUDED.revision
       RETURNING *`,
      [documentId, pageNumber, data.name || '', data.drawing_number || '', data.level || '', data.area || '', data.revision || '']
    );
    return result.rows[0];
  }

  static async getPageMetadata(documentId) {
    const result = await pool.query(
      'SELECT * FROM traceover_page_metadata WHERE document_id = $1 ORDER BY page_number',
      [documentId]
    );
    return result.rows;
  }

  // ─── Calibrations ───
  static async upsertCalibration(documentId, pageNumber, data) {
    const result = await pool.query(
      `INSERT INTO traceover_calibrations (document_id, page_number, start_point, end_point, pixel_distance, real_distance, unit, pixels_per_unit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (document_id, page_number) DO UPDATE SET
         start_point = EXCLUDED.start_point,
         end_point = EXCLUDED.end_point,
         pixel_distance = EXCLUDED.pixel_distance,
         real_distance = EXCLUDED.real_distance,
         unit = EXCLUDED.unit,
         pixels_per_unit = EXCLUDED.pixels_per_unit
       RETURNING *`,
      [
        documentId, pageNumber,
        JSON.stringify(data.start_point), JSON.stringify(data.end_point),
        data.pixel_distance, data.real_distance,
        data.unit || 'ft', data.pixels_per_unit,
      ]
    );
    return result.rows[0];
  }

  static async getCalibration(documentId, pageNumber) {
    const result = await pool.query(
      'SELECT * FROM traceover_calibrations WHERE document_id = $1 AND page_number = $2',
      [documentId, pageNumber]
    );
    return result.rows[0] || null;
  }

  static async getCalibrations(documentId) {
    const result = await pool.query(
      'SELECT * FROM traceover_calibrations WHERE document_id = $1 ORDER BY page_number',
      [documentId]
    );
    return result.rows;
  }

  static async deleteCalibration(documentId, pageNumber) {
    const result = await pool.query(
      'DELETE FROM traceover_calibrations WHERE document_id = $1 AND page_number = $2 RETURNING *',
      [documentId, pageNumber]
    );
    return result.rows[0];
  }
}

module.exports = TraceoverDocument;
