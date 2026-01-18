const db = require('../config/database');

const Drawing = {
  async create(data) {
    const result = await db.query(
      `INSERT INTO drawings (
        project_id, drawing_number, title, description, discipline,
        sheet_number, version_number, is_original_bid, is_latest,
        parent_drawing_id, file_name, file_path, file_size, file_type,
        uploaded_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        data.project_id, data.drawing_number, data.title, data.description,
        data.discipline, data.sheet_number, data.version_number,
        data.is_original_bid || false,
        data.is_latest !== undefined ? data.is_latest : true,
        data.parent_drawing_id,
        data.file_name, data.file_path, data.file_size, data.file_type,
        data.uploaded_by, data.notes
      ]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT d.*,
              u.first_name || ' ' || u.last_name as uploaded_by_name,
              pd.version_number as parent_version
       FROM drawings d
       LEFT JOIN users u ON d.uploaded_by = u.id
       LEFT JOIN drawings pd ON d.parent_drawing_id = pd.id
       WHERE d.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT d.*,
             u.first_name || ' ' || u.last_name as uploaded_by_name
      FROM drawings d
      LEFT JOIN users u ON d.uploaded_by = u.id
      WHERE d.project_id = $1
    `;
    const params = [projectId];
    let paramCount = 2;

    if (filters.discipline) {
      params.push(filters.discipline);
      query += ` AND d.discipline = $${paramCount++}`;
    }

    if (filters.is_latest !== undefined) {
      params.push(filters.is_latest);
      query += ` AND d.is_latest = $${paramCount++}`;
    }

    if (filters.drawing_number) {
      params.push(`%${filters.drawing_number}%`);
      query += ` AND d.drawing_number ILIKE $${paramCount++}`;
    }

    query += ' ORDER BY d.drawing_number, d.sheet_number, d.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async getVersionHistory(drawingId) {
    const result = await db.query(
      `WITH RECURSIVE version_chain AS (
        SELECT d.*, u.first_name || ' ' || u.last_name as uploaded_by_name, 0 as level
        FROM drawings d
        LEFT JOIN users u ON d.uploaded_by = u.id
        WHERE d.id = $1

        UNION ALL

        SELECT d.*, u.first_name || ' ' || u.last_name as uploaded_by_name, vc.level - 1
        FROM drawings d
        LEFT JOIN users u ON d.uploaded_by = u.id
        INNER JOIN version_chain vc ON d.id = vc.parent_drawing_id

        UNION ALL

        SELECT d.*, u.first_name || ' ' || u.last_name as uploaded_by_name, vc.level + 1
        FROM drawings d
        LEFT JOIN users u ON d.uploaded_by = u.id
        INNER JOIN version_chain vc ON vc.id = d.parent_drawing_id
      )
      SELECT DISTINCT ON (id) *
      FROM version_chain
      ORDER BY id, level DESC, uploaded_at DESC`,
      [drawingId]
    );
    return result.rows;
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'drawing_number', 'title', 'description', 'discipline',
      'sheet_number', 'version_number', 'is_latest', 'notes'
    ];

    Object.keys(data).forEach((key) => {
      if (allowedFields.includes(key) && data[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(data[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await db.query(
      `UPDATE drawings
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async markAsNotLatest(id) {
    await db.query(
      'UPDATE drawings SET is_latest = false, updated_at = NOW() WHERE id = $1',
      [id]
    );
  },

  async delete(id) {
    await db.query('DELETE FROM drawings WHERE id = $1', [id]);
  }
};

module.exports = Drawing;
