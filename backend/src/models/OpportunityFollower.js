const db = require('../config/database');

const OpportunityFollower = {
  async isFollowing(opportunityId, userId) {
    const result = await db.query(
      `SELECT 1 FROM opportunity_followers
       WHERE opportunity_id = $1 AND user_id = $2`,
      [opportunityId, userId]
    );
    return result.rows.length > 0;
  },

  async follow(opportunityId, userId, tenantId) {
    const result = await db.query(
      `INSERT INTO opportunity_followers (opportunity_id, user_id, tenant_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (opportunity_id, user_id) DO NOTHING
       RETURNING *`,
      [opportunityId, userId, tenantId]
    );
    return result.rows[0];
  },

  async unfollow(opportunityId, userId) {
    const result = await db.query(
      `DELETE FROM opportunity_followers
       WHERE opportunity_id = $1 AND user_id = $2
       RETURNING *`,
      [opportunityId, userId]
    );
    return result.rows[0];
  },

  async getFollowerUserIds(opportunityId, tenantId) {
    const result = await db.query(
      `SELECT user_id FROM opportunity_followers
       WHERE opportunity_id = $1 AND tenant_id = $2`,
      [opportunityId, tenantId]
    );
    return result.rows.map(r => r.user_id);
  },
};

module.exports = OpportunityFollower;
