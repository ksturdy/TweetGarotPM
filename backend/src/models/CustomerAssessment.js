const db = require('../config/database');

const CustomerAssessment = {
  // Get assessment for a customer
  async findByCustomerId(customerId) {
    const result = await db.query(
      `SELECT ca.*,
              u.first_name || ' ' || u.last_name as assessed_by_name
       FROM customer_assessments ca
       LEFT JOIN users u ON ca.assessed_by = u.id
       WHERE ca.customer_id = $1
       ORDER BY ca.assessed_at DESC
       LIMIT 1`,
      [customerId]
    );
    return result.rows[0];
  },

  // Get all assessments for a customer (history)
  async findAllByCustomerId(customerId) {
    const result = await db.query(
      `SELECT ca.*,
              u.first_name || ' ' || u.last_name as assessed_by_name
       FROM customer_assessments ca
       LEFT JOIN users u ON ca.assessed_by = u.id
       WHERE ca.customer_id = $1
       ORDER BY ca.assessed_at DESC`,
      [customerId]
    );
    return result.rows;
  },

  // Create new assessment
  async create(customerId, assessmentData, userId) {
    const { totalScore, verdict, tier, knockout, knockoutReason, criteria, notes } = assessmentData;

    const result = await db.query(
      `INSERT INTO customer_assessments
       (customer_id, total_score, verdict, tier, knockout, knockout_reason, criteria, notes, assessed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [customerId, totalScore, verdict, tier, knockout, knockoutReason, JSON.stringify(criteria), notes, userId]
    );
    return result.rows[0];
  },

  // Update existing assessment
  async update(id, assessmentData, userId) {
    const { totalScore, verdict, tier, knockout, knockoutReason, criteria, notes } = assessmentData;

    const result = await db.query(
      `UPDATE customer_assessments
       SET total_score = $1, verdict = $2, tier = $3, knockout = $4,
           knockout_reason = $5, criteria = $6, notes = $7, assessed_by = $8
       WHERE id = $9
       RETURNING *`,
      [totalScore, verdict, tier, knockout, knockoutReason, JSON.stringify(criteria), notes, userId, id]
    );
    return result.rows[0];
  },

  // Delete assessment
  async delete(id) {
    await db.query('DELETE FROM customer_assessments WHERE id = $1', [id]);
  },

  // Get summary statistics
  async getStats() {
    const result = await db.query(`
      SELECT
        verdict,
        tier,
        COUNT(*) as count,
        AVG(total_score) as avg_score
      FROM customer_assessments
      WHERE id IN (
        SELECT MAX(id) FROM customer_assessments GROUP BY customer_id
      )
      GROUP BY verdict, tier
      ORDER BY verdict, tier
    `);
    return result.rows;
  },

  // Get summary statistics (tenant-scoped via customers)
  async getStatsByTenant(tenantId) {
    const result = await db.query(`
      SELECT
        ca.verdict,
        ca.tier,
        COUNT(*) as count,
        AVG(ca.total_score) as avg_score
      FROM customer_assessments ca
      JOIN customers c ON ca.customer_id = c.id
      WHERE c.tenant_id = $1
        AND ca.id IN (
          SELECT MAX(ca2.id)
          FROM customer_assessments ca2
          JOIN customers c2 ON ca2.customer_id = c2.id
          WHERE c2.tenant_id = $1
          GROUP BY ca2.customer_id
        )
      GROUP BY ca.verdict, ca.tier
      ORDER BY ca.verdict, ca.tier
    `, [tenantId]);
    return result.rows;
  }
};

module.exports = CustomerAssessment;
