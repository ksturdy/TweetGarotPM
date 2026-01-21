const db = require('../config/database');

const campaignOpportunities = {
  // Get all opportunities for a campaign company
  getByCompanyId: async (campaignCompanyId) => {
    const query = `
      SELECT
        co.*,
        o.name as linked_opportunity_name
      FROM campaign_opportunities co
      LEFT JOIN opportunities o ON co.linked_opportunity_id = o.id
      WHERE co.campaign_company_id = $1
      ORDER BY co.created_at DESC
    `;
    const result = await db.query(query, [campaignCompanyId]);
    return result.rows;
  },

  // Get all opportunities for a campaign
  getByCampaignId: async (campaignId) => {
    const query = `
      SELECT
        co.*,
        cc.name as company_name,
        cc.tier,
        cc.score,
        o.name as linked_opportunity_name
      FROM campaign_opportunities co
      JOIN campaign_companies cc ON co.campaign_company_id = cc.id
      LEFT JOIN opportunities o ON co.linked_opportunity_id = o.id
      WHERE cc.campaign_id = $1
      ORDER BY co.value DESC, co.created_at DESC
    `;
    const result = await db.query(query, [campaignId]);
    return result.rows;
  },

  // Get opportunity by ID
  getById: async (id) => {
    const query = `
      SELECT
        co.*,
        cc.name as company_name,
        cc.campaign_id,
        o.name as linked_opportunity_name
      FROM campaign_opportunities co
      JOIN campaign_companies cc ON co.campaign_company_id = cc.id
      LEFT JOIN opportunities o ON co.linked_opportunity_id = o.id
      WHERE co.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  // Create opportunity
  create: async (data, userId) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO campaign_opportunities (
          campaign_company_id, name, description, value, stage, probability, close_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const values = [
        data.campaign_company_id,
        data.name,
        data.description || null,
        data.value || 0,
        data.stage || 'qualification',
        data.probability || 25,
        data.close_date || null
      ];
      const result = await client.query(query, values);
      const opportunity = result.rows[0];

      // Get campaign company to get campaign_id
      const ccQuery = 'SELECT campaign_id, name FROM campaign_companies WHERE id = $1';
      const ccResult = await client.query(ccQuery, [data.campaign_company_id]);
      const company = ccResult.rows[0];

      // Log activity
      const logQuery = `
        INSERT INTO campaign_activity_logs (
          campaign_id, campaign_company_id, user_id, activity_type, description,
          metadata
        )
        VALUES ($1, $2, $3, 'opportunity_created', $4, $5)
      `;
      await client.query(logQuery, [
        company.campaign_id,
        data.campaign_company_id,
        userId,
        `New opportunity created: ${opportunity.name} ($${opportunity.value})`,
        JSON.stringify({ opportunity_id: opportunity.id })
      ]);

      await client.query('COMMIT');
      return opportunity;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Update opportunity
  update: async (id, data) => {
    const query = `
      UPDATE campaign_opportunities
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          value = COALESCE($3, value),
          stage = COALESCE($4, stage),
          probability = COALESCE($5, probability),
          close_date = COALESCE($6, close_date)
      WHERE id = $7
      RETURNING *
    `;
    const values = [
      data.name,
      data.description,
      data.value,
      data.stage,
      data.probability,
      data.close_date,
      id
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Delete opportunity
  delete: async (id) => {
    const query = 'DELETE FROM campaign_opportunities WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
};

module.exports = campaignOpportunities;
