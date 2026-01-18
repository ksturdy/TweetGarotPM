const db = require('../config/database');

const Specification = {
  async create(data) {
    const result = await db.query(
      `INSERT INTO specifications (
        project_id, title, description, category, version_number,
        is_original_bid, is_latest, parent_spec_id,
        file_name, file_path, file_size, file_type,
        uploaded_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        data.project_id, data.title, data.description, data.category,
        data.version_number, data.is_original_bid || false,
        data.is_latest !== undefined ? data.is_latest : true,
        data.parent_spec_id,
        data.file_name, data.file_path, data.file_size, data.file_type,
        data.uploaded_by, data.notes
      ]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT s.*,
              u.first_name || ' ' || u.last_name as uploaded_by_name,
              ps.version_number as parent_version
       FROM specifications s
       LEFT JOIN users u ON s.uploaded_by = u.id
       LEFT JOIN specifications ps ON s.parent_spec_id = ps.id
       WHERE s.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT s.*,
             u.first_name || ' ' || u.last_name as uploaded_by_name
      FROM specifications s
      LEFT JOIN users u ON s.uploaded_by = u.id
      WHERE s.project_id = $1
    `;
    const params = [projectId];
    let paramCount = 2;

    if (filters.category) {
      params.push(filters.category);
      query += ` AND s.category = $${paramCount++}`;
    }

    if (filters.is_latest !== undefined) {
      params.push(filters.is_latest);
      query += ` AND s.is_latest = $${paramCount++}`;
    }

    query += ' ORDER BY s.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async getVersionHistory(specId) {
    // Get all versions in the chain
    const result = await db.query(
      `WITH RECURSIVE version_chain AS (
        -- Start with the requested spec
        SELECT s.*, u.first_name || ' ' || u.last_name as uploaded_by_name, 0 as level
        FROM specifications s
        LEFT JOIN users u ON s.uploaded_by = u.id
        WHERE s.id = $1

        UNION ALL

        -- Get parent versions
        SELECT s.*, u.first_name || ' ' || u.last_name as uploaded_by_name, vc.level - 1
        FROM specifications s
        LEFT JOIN users u ON s.uploaded_by = u.id
        INNER JOIN version_chain vc ON s.id = vc.parent_spec_id

        UNION ALL

        -- Get child versions
        SELECT s.*, u.first_name || ' ' || u.last_name as uploaded_by_name, vc.level + 1
        FROM specifications s
        LEFT JOIN users u ON s.uploaded_by = u.id
        INNER JOIN version_chain vc ON vc.id = s.parent_spec_id
      )
      SELECT DISTINCT ON (id) *
      FROM version_chain
      ORDER BY id, level DESC, uploaded_at DESC`,
      [specId]
    );
    return result.rows;
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'title', 'description', 'category', 'version_number',
      'is_latest', 'notes'
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
      `UPDATE specifications
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async markAsNotLatest(id) {
    await db.query(
      'UPDATE specifications SET is_latest = false, updated_at = NOW() WHERE id = $1',
      [id]
    );
  },

  async delete(id) {
    await db.query('DELETE FROM specifications WHERE id = $1', [id]);
  },

  // Question methods
  async createQuestion(data) {
    const result = await db.query(
      `INSERT INTO specification_questions (
        specification_id, question, asked_by
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [data.specification_id, data.question, data.asked_by]
    );
    return result.rows[0];
  },

  async findQuestionById(id) {
    const result = await db.query(
      `SELECT sq.*,
              u1.first_name || ' ' || u1.last_name as asked_by_name,
              u2.first_name || ' ' || u2.last_name as answered_by_name
       FROM specification_questions sq
       LEFT JOIN users u1 ON sq.asked_by = u1.id
       LEFT JOIN users u2 ON sq.answered_by = u2.id
       WHERE sq.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findQuestionsBySpec(specId, filters = {}) {
    let query = `
      SELECT sq.*,
             u1.first_name || ' ' || u1.last_name as asked_by_name,
             u2.first_name || ' ' || u2.last_name as answered_by_name
      FROM specification_questions sq
      LEFT JOIN users u1 ON sq.asked_by = u1.id
      LEFT JOIN users u2 ON sq.answered_by = u2.id
      WHERE sq.specification_id = $1
    `;
    const params = [specId];
    let paramCount = 2;

    if (filters.status) {
      params.push(filters.status);
      query += ` AND sq.status = $${paramCount++}`;
    }

    query += ' ORDER BY sq.asked_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async answerQuestion(id, answer, answeredBy) {
    const result = await db.query(
      `UPDATE specification_questions
       SET answer = $1, answered_by = $2, answered_at = NOW(),
           status = 'answered', updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [answer, answeredBy, id]
    );
    return result.rows[0];
  },

  async updateQuestion(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = ['question', 'answer', 'status'];

    Object.keys(data).forEach((key) => {
      if (allowedFields.includes(key) && data[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(data[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this.findQuestionById(id);
    }

    values.push(id);
    const result = await db.query(
      `UPDATE specification_questions
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async deleteQuestion(id) {
    await db.query('DELETE FROM specification_questions WHERE id = $1', [id]);
  }
};

module.exports = Specification;
