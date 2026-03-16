const pool = require('../config/database');

class AssemblyTemplate {
  // ─── Find all templates for a tenant ───
  static async findAll(tenantId, { category } = {}) {
    let query = `SELECT at.*, u.name as created_by_name
       FROM assembly_templates at
       LEFT JOIN users u ON at.created_by = u.id
       WHERE at.tenant_id = $1`;
    const params = [tenantId];

    if (category) {
      query += ' AND at.category = $2';
      params.push(category);
    }

    query += ' ORDER BY at.category, at.name';
    const result = await pool.query(query, params);
    return result.rows;
  }

  // ─── Find by ID ───
  static async findById(id) {
    const result = await pool.query(
      `SELECT at.*, u.name as created_by_name
       FROM assembly_templates at
       LEFT JOIN users u ON at.created_by = u.id
       WHERE at.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // ─── Create ───
  static async create(data) {
    const result = await pool.query(
      `INSERT INTO assembly_templates (tenant_id, name, description, category, bounding_box, runs, placed_items, connection_points, thumbnail_data_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.tenant_id, data.name, data.description || '',
        data.category || '',
        JSON.stringify(data.bounding_box || { width: 200, height: 200 }),
        JSON.stringify(data.runs || []),
        JSON.stringify(data.placed_items || []),
        JSON.stringify(data.connection_points || []),
        data.thumbnail_data_url || null,
        data.created_by || null,
      ]
    );
    return result.rows[0];
  }

  // ─── Update ───
  static async update(id, data) {
    const allowedFields = ['name', 'description', 'category', 'bounding_box', 'runs', 'placed_items', 'connection_points', 'thumbnail_data_url'];
    const jsonFields = ['bounding_box', 'runs', 'placed_items', 'connection_points'];

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
      `UPDATE assembly_templates SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  // ─── Delete ───
  static async delete(id) {
    const result = await pool.query(
      'DELETE FROM assembly_templates WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // ─── Duplicate ───
  static async duplicate(id, newName) {
    const template = await this.findById(id);
    if (!template) return null;

    return this.create({
      tenant_id: template.tenant_id,
      name: newName || `${template.name} (Copy)`,
      description: template.description,
      category: template.category,
      bounding_box: template.bounding_box,
      runs: template.runs,
      placed_items: template.placed_items,
      connection_points: template.connection_points,
      thumbnail_data_url: template.thumbnail_data_url,
      created_by: template.created_by,
    });
  }

  // ─── Get distinct categories ───
  static async getCategories(tenantId) {
    const result = await pool.query(
      `SELECT DISTINCT category FROM assembly_templates WHERE tenant_id = $1 AND category != '' ORDER BY category`,
      [tenantId]
    );
    return result.rows.map(r => r.category);
  }
}

module.exports = AssemblyTemplate;
