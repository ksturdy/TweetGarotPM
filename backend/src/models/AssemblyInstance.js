const pool = require('../config/database');

class AssemblyInstance {
  // ─── Find all instances for a takeoff ───
  static async findByTakeoff(takeoffId) {
    const result = await pool.query(
      `SELECT ai.*, at.name as template_name, at.category as template_category
       FROM assembly_instances ai
       LEFT JOIN assembly_templates at ON ai.assembly_template_id = at.id
       WHERE ai.takeoff_id = $1
       ORDER BY ai.created_at DESC`,
      [takeoffId]
    );
    return result.rows;
  }

  // ─── Find instances on a specific document page ───
  static async findByDocumentPage(documentId, pageNumber) {
    const result = await pool.query(
      `SELECT ai.*, at.name as template_name, at.category as template_category
       FROM assembly_instances ai
       LEFT JOIN assembly_templates at ON ai.assembly_template_id = at.id
       WHERE ai.document_id = $1 AND ai.page_number = $2
       ORDER BY ai.created_at ASC`,
      [documentId, pageNumber]
    );
    return result.rows;
  }

  // ─── Find by ID ───
  static async findById(id) {
    const result = await pool.query(
      `SELECT ai.*, at.name as template_name, at.category as template_category,
              at.runs as template_runs, at.placed_items as template_placed_items,
              at.connection_points as template_connection_points
       FROM assembly_instances ai
       LEFT JOIN assembly_templates at ON ai.assembly_template_id = at.id
       WHERE ai.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // ─── Create ───
  static async create(data) {
    const result = await pool.query(
      `INSERT INTO assembly_instances (tenant_id, takeoff_id, assembly_template_id, assembly_name, origin, document_id, page_number, run_ids, item_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.tenant_id, data.takeoff_id, data.assembly_template_id,
        data.assembly_name || '',
        JSON.stringify(data.origin || { x: 0, y: 0 }),
        data.document_id || null, data.page_number || null,
        data.run_ids || [], data.item_ids || [],
      ]
    );
    return result.rows[0];
  }

  // ─── Update ───
  static async update(id, data) {
    const allowedFields = ['assembly_name', 'origin', 'document_id', 'page_number', 'run_ids', 'item_ids'];
    const jsonFields = ['origin'];

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
      `UPDATE assembly_instances SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  // ─── Delete ───
  static async delete(id) {
    const result = await pool.query(
      'DELETE FROM assembly_instances WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }
}

module.exports = AssemblyInstance;
