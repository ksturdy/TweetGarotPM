const db = require('../config/database');

const campaigns = {
  // Get all campaigns
  getAll: async () => {
    const query = `
      SELECT
        c.*,
        CONCAT(u.first_name, ' ', u.last_name) as owner_name,
        COUNT(DISTINCT cc.id) as company_count,
        COUNT(DISTINCT CASE WHEN cc.status != 'prospect' THEN cc.id END) as contacted,
        COUNT(DISTINCT co.id) as opportunities,
        COALESCE(SUM(co.value), 0) as pipeline_value
      FROM campaigns c
      LEFT JOIN users u ON c.owner_id = u.id
      LEFT JOIN campaign_companies cc ON c.id = cc.campaign_id
      LEFT JOIN campaign_opportunities co ON cc.id = co.campaign_company_id
      GROUP BY c.id, u.first_name, u.last_name
      ORDER BY c.created_at DESC
    `;
    const result = await db.query(query);
    return result.rows;
  },

  // Get campaign by ID with stats
  getById: async (id) => {
    const query = `
      SELECT
        c.*,
        CONCAT(u.first_name, ' ', u.last_name) as owner_name,
        u.email as owner_email,
        COUNT(DISTINCT cc.id) as company_count,
        COUNT(DISTINCT CASE WHEN cc.status != 'prospect' THEN cc.id END) as contacted,
        COUNT(DISTINCT co.id) as opportunities,
        COALESCE(SUM(co.value), 0) as pipeline_value
      FROM campaigns c
      LEFT JOIN users u ON c.owner_id = u.id
      LEFT JOIN campaign_companies cc ON c.id = cc.campaign_id
      LEFT JOIN campaign_opportunities co ON cc.id = co.campaign_company_id
      WHERE c.id = $1
      GROUP BY c.id, u.first_name, u.last_name, u.email
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  // Create campaign
  create: async (data) => {
    const query = `
      INSERT INTO campaigns (name, description, start_date, end_date, status, owner_id, total_targets)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      data.name,
      data.description,
      data.start_date,
      data.end_date,
      data.status || 'planning',
      data.owner_id,
      data.total_targets || 0
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Update campaign
  update: async (id, data) => {
    const query = `
      UPDATE campaigns
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          start_date = COALESCE($3, start_date),
          end_date = COALESCE($4, end_date),
          status = COALESCE($5, status),
          owner_id = COALESCE($6, owner_id),
          total_targets = COALESCE($7, total_targets)
      WHERE id = $8
      RETURNING *
    `;
    const values = [
      data.name,
      data.description,
      data.start_date,
      data.end_date,
      data.status,
      data.owner_id,
      data.total_targets,
      id
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Delete campaign
  delete: async (id) => {
    const query = 'DELETE FROM campaigns WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  // Get campaign weeks
  getWeeks: async (campaignId) => {
    const query = `
      SELECT * FROM campaign_weeks
      WHERE campaign_id = $1
      ORDER BY week_number
    `;
    const result = await db.query(query, [campaignId]);
    return result.rows;
  },

  // Create campaign week
  createWeek: async (campaignId, data) => {
    const query = `
      INSERT INTO campaign_weeks (campaign_id, week_number, start_date, end_date, label)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [campaignId, data.week_number, data.start_date, data.end_date, data.label];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Get team members for campaign
  getTeamMembers: async (campaignId) => {
    const query = `
      SELECT
        ctm.*,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.email,
        COUNT(DISTINCT cc.id) as assigned_companies,
        COUNT(DISTINCT CASE WHEN cc.status != 'prospect' THEN cc.id END) as contacted_companies
      FROM campaign_team_members ctm
      JOIN users u ON ctm.user_id = u.id
      LEFT JOIN campaign_companies cc ON cc.campaign_id = ctm.campaign_id AND cc.assigned_to_id = ctm.user_id
      WHERE ctm.campaign_id = $1
      GROUP BY ctm.id, u.first_name, u.last_name, u.email
      ORDER BY ctm.role, u.first_name, u.last_name
    `;
    const result = await db.query(query, [campaignId]);
    return result.rows;
  },

  // Add team member
  addTeamMember: async (campaignId, userId, role = 'member') => {
    const query = `
      INSERT INTO campaign_team_members (campaign_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (campaign_id, user_id)
      DO UPDATE SET role = $3
      RETURNING *
    `;
    const result = await db.query(query, [campaignId, userId, role]);
    return result.rows[0];
  },

  // Get campaign statistics by status
  getStatusStats: async (campaignId) => {
    const query = `
      SELECT
        status,
        COUNT(*) as count
      FROM campaign_companies
      WHERE campaign_id = $1
      GROUP BY status
      ORDER BY status
    `;
    const result = await db.query(query, [campaignId]);
    return result.rows;
  },

  // Get campaign statistics by week
  getWeeklyStats: async (campaignId) => {
    const query = `
      SELECT
        target_week,
        COUNT(*) as total,
        COUNT(CASE WHEN status != 'prospect' THEN 1 END) as contacted,
        COUNT(CASE WHEN status = 'new_opp' THEN 1 END) as opportunities
      FROM campaign_companies
      WHERE campaign_id = $1 AND target_week IS NOT NULL
      GROUP BY target_week
      ORDER BY target_week
    `;
    const result = await db.query(query, [campaignId]);
    return result.rows;
  }
};

module.exports = campaigns;
