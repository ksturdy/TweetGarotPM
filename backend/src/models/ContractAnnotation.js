const db = require('../config/database');

const ContractAnnotation = {
  async create(data) {
    const params = [
      data.contract_review_id,
      data.annotation_type,
      data.page_number || null,
      data.location_start || null,
      data.location_end || null,
      data.quoted_text || null,
      data.content || null,
      data.color || 'red',
      data.risk_finding_id || null,
      data.created_by
    ];

    const result = await db.query(
      `INSERT INTO contract_annotations (
        contract_review_id, annotation_type, page_number, location_start,
        location_end, quoted_text, content, color, risk_finding_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      params
    );
    return result.rows[0];
  },

  async findByContractReview(contractReviewId) {
    const result = await db.query(
      `SELECT ca.*,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM contract_annotations ca
       LEFT JOIN users u ON ca.created_by = u.id
       WHERE ca.contract_review_id = $1
       ORDER BY ca.page_number, ca.location_start`,
      [contractReviewId]
    );
    return result.rows;
  },

  async findById(id) {
    const result = await db.query(
      `SELECT ca.*,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM contract_annotations ca
       LEFT JOIN users u ON ca.created_by = u.id
       WHERE ca.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'annotation_type', 'page_number', 'location_start', 'location_end',
      'quoted_text', 'content', 'color', 'risk_finding_id'
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
      `UPDATE contract_annotations SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM contract_annotations WHERE id = $1', [id]);
  },

  async deleteByContractReview(contractReviewId) {
    await db.query('DELETE FROM contract_annotations WHERE contract_review_id = $1', [contractReviewId]);
  }
};

module.exports = ContractAnnotation;
