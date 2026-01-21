const db = require('../config/database');

const campaignEstimates = {
  // Get all estimates for a campaign company
  getByCompanyId: async (campaignCompanyId) => {
    const query = `
      SELECT
        ce.*,
        co.name as opportunity_name
      FROM campaign_estimates ce
      LEFT JOIN campaign_opportunities co ON ce.campaign_opportunity_id = co.id
      WHERE ce.campaign_company_id = $1
      ORDER BY ce.created_at DESC
    `;
    const result = await db.query(query, [campaignCompanyId]);
    return result.rows;
  },

  // Get all estimates for a campaign
  getByCampaignId: async (campaignId) => {
    const query = `
      SELECT
        ce.*,
        cc.name as company_name,
        co.name as opportunity_name
      FROM campaign_estimates ce
      JOIN campaign_companies cc ON ce.campaign_company_id = cc.id
      LEFT JOIN campaign_opportunities co ON ce.campaign_opportunity_id = co.id
      WHERE cc.campaign_id = $1
      ORDER BY ce.created_at DESC
    `;
    const result = await db.query(query, [campaignId]);
    return result.rows;
  },

  // Get estimate by ID
  getById: async (id) => {
    const query = `
      SELECT
        ce.*,
        cc.name as company_name,
        cc.campaign_id,
        co.name as opportunity_name
      FROM campaign_estimates ce
      JOIN campaign_companies cc ON ce.campaign_company_id = cc.id
      LEFT JOIN campaign_opportunities co ON ce.campaign_opportunity_id = co.id
      WHERE ce.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  // Generate next estimate number
  generateEstimateNumber: async () => {
    const query = `
      SELECT estimate_number FROM campaign_estimates
      WHERE estimate_number LIKE 'EST-2025-%'
      ORDER BY estimate_number DESC
      LIMIT 1
    `;
    const result = await db.query(query);

    if (result.rows.length === 0) {
      return 'EST-2025-001';
    }

    const lastNumber = result.rows[0].estimate_number;
    const match = lastNumber.match(/EST-2025-(\d+)/);
    if (match) {
      const nextNum = parseInt(match[1]) + 1;
      return `EST-2025-${String(nextNum).padStart(3, '0')}`;
    }

    return 'EST-2025-001';
  },

  // Create estimate
  create: async (data, userId) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Generate estimate number if not provided
      let estimateNumber = data.estimate_number;
      if (!estimateNumber) {
        const numberQuery = `
          SELECT estimate_number FROM campaign_estimates
          WHERE estimate_number LIKE 'EST-2025-%'
          ORDER BY estimate_number DESC
          LIMIT 1
        `;
        const numberResult = await client.query(numberQuery);

        if (numberResult.rows.length === 0) {
          estimateNumber = 'EST-2025-001';
        } else {
          const lastNumber = numberResult.rows[0].estimate_number;
          const match = lastNumber.match(/EST-2025-(\d+)/);
          if (match) {
            const nextNum = parseInt(match[1]) + 1;
            estimateNumber = `EST-2025-${String(nextNum).padStart(3, '0')}`;
          } else {
            estimateNumber = 'EST-2025-001';
          }
        }
      }

      const query = `
        INSERT INTO campaign_estimates (
          campaign_company_id, campaign_opportunity_id, estimate_number,
          name, amount, status, sent_date, valid_until, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const values = [
        data.campaign_company_id,
        data.campaign_opportunity_id || null,
        estimateNumber,
        data.name,
        data.amount || 0,
        data.status || 'draft',
        data.sent_date || null,
        data.valid_until || null,
        data.notes || null
      ];
      const result = await client.query(query, values);
      const estimate = result.rows[0];

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
        VALUES ($1, $2, $3, 'estimate_sent', $4, $5)
      `;
      await client.query(logQuery, [
        company.campaign_id,
        data.campaign_company_id,
        userId,
        `New estimate created: ${estimate.estimate_number} - ${estimate.name} ($${estimate.amount})`,
        JSON.stringify({ estimate_id: estimate.id })
      ]);

      await client.query('COMMIT');
      return estimate;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Update estimate
  update: async (id, data) => {
    const query = `
      UPDATE campaign_estimates
      SET name = COALESCE($1, name),
          amount = COALESCE($2, amount),
          status = COALESCE($3, status),
          sent_date = COALESCE($4, sent_date),
          valid_until = COALESCE($5, valid_until),
          notes = COALESCE($6, notes),
          campaign_opportunity_id = COALESCE($7, campaign_opportunity_id)
      WHERE id = $8
      RETURNING *
    `;
    const values = [
      data.name,
      data.amount,
      data.status,
      data.sent_date,
      data.valid_until,
      data.notes,
      data.campaign_opportunity_id,
      id
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Delete estimate
  delete: async (id) => {
    const query = 'DELETE FROM campaign_estimates WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
};

module.exports = campaignEstimates;
