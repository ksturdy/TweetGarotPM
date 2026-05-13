const db = require('../config/database');

const OpportunityLink = {
  async findByOpportunityId(opportunityId, tenantId) {
    const result = await db.query(
      `SELECT ol.*,
              u.first_name || ' ' || u.last_name AS created_by_name
       FROM opportunity_links ol
       LEFT JOIN users u ON ol.created_by = u.id
       WHERE ol.opportunity_id = $1 AND ol.tenant_id = $2
       ORDER BY ol.created_at ASC`,
      [opportunityId, tenantId]
    );
    return result.rows;
  },

  async create(opportunityId, userId, tenantId, url) {
    const result = await db.query(
      `INSERT INTO opportunity_links (opportunity_id, tenant_id, url, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [opportunityId, tenantId, url, userId]
    );
    return result.rows[0];
  },

  async update(linkId, tenantId, url) {
    const result = await db.query(
      `UPDATE opportunity_links
       SET url = $3
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [linkId, tenantId, url]
    );
    return result.rows[0];
  },

  async delete(linkId, tenantId) {
    const result = await db.query(
      `DELETE FROM opportunity_links
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [linkId, tenantId]
    );
    return result.rows[0];
  },
};

module.exports = OpportunityLink;
