const db = require('../config/database');

const OpportunityComment = {
  async findByOpportunityId(opportunityId, tenantId) {
    const result = await db.query(
      `SELECT oc.*,
              u.first_name || ' ' || u.last_name AS commenter_name,
              u.email AS commenter_email
       FROM opportunity_comments oc
       JOIN users u ON oc.user_id = u.id
       WHERE oc.opportunity_id = $1 AND oc.tenant_id = $2
       ORDER BY oc.created_at ASC`,
      [opportunityId, tenantId]
    );
    return result.rows;
  },

  async create(opportunityId, userId, tenantId, comment) {
    const result = await db.query(
      `INSERT INTO opportunity_comments (opportunity_id, user_id, tenant_id, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [opportunityId, userId, tenantId, comment]
    );
    return result.rows[0];
  },

  async update(commentId, userId, comment) {
    const result = await db.query(
      `UPDATE opportunity_comments
       SET comment = $3
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [commentId, userId, comment]
    );
    return result.rows[0];
  },

  async delete(commentId, userId) {
    const result = await db.query(
      `DELETE FROM opportunity_comments
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [commentId, userId]
    );
    return result.rows[0];
  },
};

module.exports = OpportunityComment;
