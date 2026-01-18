const db = require('../config/database');

const ContractReview = {
  async create(data) {
    const result = await db.query(
      `INSERT INTO contract_reviews (
        file_name, file_size, file_path, project_name, general_contractor,
        contract_value, overall_risk, analysis_completed_at, status,
        needs_legal_review, uploaded_by, review_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        data.file_name,
        data.file_size,
        data.file_path,
        data.project_name,
        data.general_contractor,
        data.contract_value,
        data.overall_risk,
        data.analysis_completed_at || new Date(),
        data.status || 'pending',
        data.needs_legal_review || false,
        data.uploaded_by,
        data.review_notes
      ]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT cr.*,
              u1.first_name || ' ' || u1.last_name as uploaded_by_name,
              u2.first_name || ' ' || u2.last_name as reviewed_by_name,
              u3.first_name || ' ' || u3.last_name as approved_by_name
       FROM contract_reviews cr
       LEFT JOIN users u1 ON cr.uploaded_by = u1.id
       LEFT JOIN users u2 ON cr.reviewed_by = u2.id
       LEFT JOIN users u3 ON cr.approved_by = u3.id
       WHERE cr.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findAll(filters = {}) {
    let query = `
      SELECT cr.*,
             u1.first_name || ' ' || u1.last_name as uploaded_by_name,
             u2.first_name || ' ' || u2.last_name as reviewed_by_name
      FROM contract_reviews cr
      LEFT JOIN users u1 ON cr.uploaded_by = u1.id
      LEFT JOIN users u2 ON cr.reviewed_by = u2.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.status) {
      params.push(filters.status);
      query += ` AND cr.status = $${paramCount++}`;
    }

    if (filters.overall_risk) {
      params.push(filters.overall_risk);
      query += ` AND cr.overall_risk = $${paramCount++}`;
    }

    if (filters.needs_legal_review !== undefined) {
      params.push(filters.needs_legal_review);
      query += ` AND cr.needs_legal_review = $${paramCount++}`;
    }

    if (filters.uploaded_by) {
      params.push(filters.uploaded_by);
      query += ` AND cr.uploaded_by = $${paramCount++}`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      query += ` AND (cr.project_name ILIKE $${paramCount} OR cr.general_contractor ILIKE $${paramCount} OR cr.file_name ILIKE $${paramCount})`;
      paramCount++;
    }

    query += ' ORDER BY cr.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'status', 'reviewed_by', 'approved_by', 'review_notes',
      'approval_notes', 'reviewed_at', 'approved_at', 'needs_legal_review',
      'project_name', 'general_contractor', 'contract_value', 'overall_risk'
    ];

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${paramCount}`);
        values.push(data[field]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const result = await db.query(
      `UPDATE contract_reviews SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM contract_reviews WHERE id = $1', [id]);
  },

  async getStats() {
    const result = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'under_review') as under_review,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE overall_risk = 'HIGH') as high_risk,
        COUNT(*) FILTER (WHERE overall_risk = 'MODERATE') as moderate_risk,
        COUNT(*) FILTER (WHERE overall_risk = 'LOW') as low_risk,
        COUNT(*) FILTER (WHERE needs_legal_review = true) as needs_legal_review,
        SUM(contract_value) as total_contract_value,
        AVG(contract_value) as avg_contract_value
      FROM contract_reviews
    `);
    return result.rows[0];
  }
};

module.exports = ContractReview;
