const pool = require('../config/database');

class TraceoverRun {
  // ─── Find all runs for a takeoff ───
  static async findByTakeoff(takeoffId) {
    const result = await pool.query(
      `SELECT tr.*, td.original_name as document_name
       FROM traceover_runs tr
       LEFT JOIN traceover_documents td ON tr.document_id = td.id
       WHERE tr.takeoff_id = $1
       ORDER BY tr.created_at DESC`,
      [takeoffId]
    );
    return result.rows;
  }

  // ─── Find runs for a specific document/page ───
  static async findByDocumentPage(documentId, pageNumber) {
    const result = await pool.query(
      `SELECT * FROM traceover_runs
       WHERE document_id = $1 AND page_number = $2
       ORDER BY created_at ASC`,
      [documentId, pageNumber]
    );
    return result.rows;
  }

  // ─── Find by ID ───
  static async findById(id) {
    const result = await pool.query(
      `SELECT tr.*, td.original_name as document_name
       FROM traceover_runs tr
       LEFT JOIN traceover_documents td ON tr.document_id = td.id
       WHERE tr.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // ─── Create ───
  static async create(data) {
    const result = await pool.query(
      `INSERT INTO traceover_runs (
        tenant_id, takeoff_id, document_id, page_number,
        config, segments, branches, is_complete,
        total_pixel_length, total_scaled_length, vertical_pipe_length,
        fitting_counts, generated_takeoff_item_ids, branch_parent_pipe_size
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        data.tenant_id, data.takeoff_id, data.document_id || null, data.page_number || null,
        JSON.stringify(data.config || {}),
        JSON.stringify(data.segments || []),
        JSON.stringify(data.branches || []),
        data.is_complete || false,
        data.total_pixel_length || 0,
        data.total_scaled_length || 0,
        data.vertical_pipe_length || 0,
        JSON.stringify(data.fitting_counts || {}),
        data.generated_takeoff_item_ids || [],
        data.branch_parent_pipe_size ? JSON.stringify(data.branch_parent_pipe_size) : null,
      ]
    );
    return result.rows[0];
  }

  // ─── Update ───
  static async update(id, data) {
    const allowedFields = [
      'document_id', 'page_number', 'config', 'segments', 'branches',
      'is_complete', 'total_pixel_length', 'total_scaled_length',
      'vertical_pipe_length', 'fitting_counts', 'generated_takeoff_item_ids',
      'branch_parent_pipe_size',
    ];
    const jsonFields = ['config', 'segments', 'branches', 'fitting_counts', 'branch_parent_pipe_size'];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(jsonFields.includes(field) ? JSON.stringify(data[field]) : data[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);
    const result = await pool.query(
      `UPDATE traceover_runs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  // ─── Delete ───
  static async delete(id) {
    const result = await pool.query(
      'DELETE FROM traceover_runs WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // ─── Delete all runs for a document page ───
  static async deleteByDocumentPage(documentId, pageNumber) {
    const result = await pool.query(
      'DELETE FROM traceover_runs WHERE document_id = $1 AND page_number = $2 RETURNING *',
      [documentId, pageNumber]
    );
    return result.rows;
  }

  // ─── Summary stats for a takeoff ───
  static async getSummary(takeoffId) {
    const result = await pool.query(
      `SELECT
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE is_complete) as complete_runs,
        COALESCE(SUM(total_scaled_length), 0) as total_pipe_length,
        COALESCE(SUM(vertical_pipe_length), 0) as total_vertical_length
       FROM traceover_runs
       WHERE takeoff_id = $1`,
      [takeoffId]
    );
    return result.rows[0];
  }
}

module.exports = TraceoverRun;
