const db = require('../config/database');

const OpportunityHistory = {
  async log({ opportunityId, tenantId, userId, eventType, summary, changes = [] }) {
    await db.query(
      `INSERT INTO opportunity_history (opportunity_id, tenant_id, user_id, event_type, summary, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [opportunityId, tenantId, userId, eventType, summary, JSON.stringify(changes)]
    );
  },

  async findByOpportunity(opportunityId, tenantId) {
    const result = await db.query(
      `SELECT h.*, u.first_name || ' ' || u.last_name AS user_name
       FROM opportunity_history h
       LEFT JOIN users u ON u.id = h.user_id
       WHERE h.opportunity_id = $1 AND h.tenant_id = $2
       ORDER BY h.created_at DESC`,
      [opportunityId, tenantId]
    );
    return result.rows;
  },
};

module.exports = OpportunityHistory;
