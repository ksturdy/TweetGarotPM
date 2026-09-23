const db = require('../config/database');

const FeedbackFollower = {
  async isFollowing(feedbackId, userId) {
    const { rows } = await db.query(
      `SELECT 1 FROM feedback_followers WHERE feedback_id=$1 AND user_id=$2`,
      [feedbackId, userId]
    );
    return rows.length > 0;
  },

  async follow(feedbackId, userId, tenantId, addedBy) {
    const { rows } = await db.query(
      `INSERT INTO feedback_followers (feedback_id, user_id, tenant_id, added_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (feedback_id, user_id) DO NOTHING
       RETURNING *`,
      [feedbackId, userId, tenantId, addedBy ?? userId]
    );
    return rows[0];
  },

  async unfollow(feedbackId, userId) {
    const { rows } = await db.query(
      `DELETE FROM feedback_followers WHERE feedback_id=$1 AND user_id=$2 RETURNING *`,
      [feedbackId, userId]
    );
    return rows[0];
  },

  async getFollowers(feedbackId, tenantId) {
    const { rows } = await db.query(
      `SELECT ff.user_id, ff.created_at,
              u.first_name, u.last_name, u.email
       FROM feedback_followers ff
       JOIN users u ON u.id = ff.user_id
       WHERE ff.feedback_id=$1 AND ff.tenant_id=$2
       ORDER BY ff.created_at ASC`,
      [feedbackId, tenantId]
    );
    return rows;
  },

  async getFollowerUserIds(feedbackId, tenantId) {
    const { rows } = await db.query(
      `SELECT user_id FROM feedback_followers WHERE feedback_id=$1 AND tenant_id=$2`,
      [feedbackId, tenantId]
    );
    return rows.map(r => r.user_id);
  },
};

module.exports = FeedbackFollower;
