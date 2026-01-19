const db = require('../config/database');

const ContractRiskFinding = {
  async create(data) {
    console.log('ContractRiskFinding.create - Input data:', data);
    const params = [
      data.contract_review_id,
      data.category,
      data.title,
      data.risk_level,
      data.finding,
      data.recommendation || null,
      data.status || 'open',
      data.resolution_notes || null,
      data.resolved_by || null,
      data.page_number || null,
      data.location_start || null,
      data.location_end || null,
      data.quoted_text || null
    ];
    console.log('ContractRiskFinding.create - SQL params:', params);

    const result = await db.query(
      `INSERT INTO contract_risk_findings (
        contract_review_id, category, title, risk_level, finding,
        recommendation, status, resolution_notes, resolved_by,
        page_number, location_start, location_end, quoted_text
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      params
    );
    console.log('ContractRiskFinding.create - Result:', result.rows[0]);
    return result.rows[0];
  },

  async findByContractReview(contractReviewId) {
    const result = await db.query(
      `SELECT crf.*,
              u.first_name || ' ' || u.last_name as resolved_by_name
       FROM contract_risk_findings crf
       LEFT JOIN users u ON crf.resolved_by = u.id
       WHERE crf.contract_review_id = $1
       ORDER BY
         CASE crf.risk_level
           WHEN 'HIGH' THEN 1
           WHEN 'MODERATE' THEN 2
           WHEN 'LOW' THEN 3
         END,
         crf.created_at`,
      [contractReviewId]
    );
    return result.rows;
  },

  async findById(id) {
    const result = await db.query(
      `SELECT crf.*,
              u.first_name || ' ' || u.last_name as resolved_by_name
       FROM contract_risk_findings crf
       LEFT JOIN users u ON crf.resolved_by = u.id
       WHERE crf.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async update(id, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'status', 'resolution_notes', 'resolved_by', 'resolved_at',
      'category', 'title', 'risk_level', 'finding', 'recommendation',
      'page_number', 'location_start', 'location_end', 'quoted_text'
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
      `UPDATE contract_risk_findings SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM contract_risk_findings WHERE id = $1', [id]);
  },

  async deleteByContractReview(contractReviewId) {
    await db.query('DELETE FROM contract_risk_findings WHERE contract_review_id = $1', [contractReviewId]);
  }
};

module.exports = ContractRiskFinding;
