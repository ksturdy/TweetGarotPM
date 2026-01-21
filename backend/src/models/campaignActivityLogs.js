const db = require('../config/database');

const campaignActivityLogs = {
  // Get activity logs for a campaign
  getByCampaignId: async (campaignId, limit = 100) => {
    const query = `
      SELECT
        cal.*,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        cc.name as company_name
      FROM campaign_activity_logs cal
      LEFT JOIN users u ON cal.user_id = u.id
      LEFT JOIN campaign_companies cc ON cal.campaign_company_id = cc.id
      WHERE cal.campaign_id = $1
      ORDER BY cal.created_at DESC
      LIMIT $2
    `;
    const result = await db.query(query, [campaignId, limit]);
    return result.rows;
  },

  // Get activity logs for a campaign company
  getByCompanyId: async (campaignCompanyId, limit = 50) => {
    const query = `
      SELECT
        cal.*,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM campaign_activity_logs cal
      LEFT JOIN users u ON cal.user_id = u.id
      WHERE cal.campaign_company_id = $1
      ORDER BY cal.created_at DESC
      LIMIT $2
    `;
    const result = await db.query(query, [campaignCompanyId, limit]);
    return result.rows;
  },

  // Create activity log
  create: async (data) => {
    const query = `
      INSERT INTO campaign_activity_logs (
        campaign_id, campaign_company_id, user_id, activity_type, description, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [
      data.campaign_id,
      data.campaign_company_id || null,
      data.user_id,
      data.activity_type,
      data.description,
      data.metadata ? JSON.stringify(data.metadata) : null
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Add a note to a campaign company
  addNote: async (campaignId, campaignCompanyId, userId, note) => {
    const query = `
      INSERT INTO campaign_activity_logs (
        campaign_id, campaign_company_id, user_id, activity_type, description
      )
      VALUES ($1, $2, $3, 'note', $4)
      RETURNING *
    `;
    const result = await db.query(query, [campaignId, campaignCompanyId, userId, note]);
    return result.rows[0];
  },

  // Log a contact attempt
  logContactAttempt: async (campaignId, campaignCompanyId, userId, method, notes) => {
    const query = `
      INSERT INTO campaign_activity_logs (
        campaign_id, campaign_company_id, user_id, activity_type, description, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const activityType = method === 'phone' ? 'phone_call' : method === 'email' ? 'email' : 'contact_attempt';
    const description = `${method.charAt(0).toUpperCase() + method.slice(1)} contact attempt${notes ? ': ' + notes : ''}`;
    const metadata = { method, notes };

    const result = await db.query(query, [
      campaignId,
      campaignCompanyId,
      userId,
      activityType,
      description,
      JSON.stringify(metadata)
    ]);
    return result.rows[0];
  },

  // Delete activity log
  delete: async (id) => {
    const query = 'DELETE FROM campaign_activity_logs WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
};

module.exports = campaignActivityLogs;
