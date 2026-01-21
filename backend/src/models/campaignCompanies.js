const db = require('../config/database');

const campaignCompanies = {
  // Get all companies for a campaign
  getByCampaignId: async (campaignId, filters = {}) => {
    let query = `
      SELECT
        cc.*,
        CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name,
        COUNT(DISTINCT cco.id) as contact_count,
        COUNT(DISTINCT co.id) as opportunity_count,
        COALESCE(SUM(co.value), 0) as total_opportunity_value,
        c.name as linked_company_name
      FROM campaign_companies cc
      LEFT JOIN users u ON cc.assigned_to_id = u.id
      LEFT JOIN campaign_contacts cco ON cc.id = cco.campaign_company_id
      LEFT JOIN campaign_opportunities co ON cc.id = co.campaign_company_id
      LEFT JOIN companies c ON cc.linked_company_id = c.id
      WHERE cc.campaign_id = $1
    `;

    const params = [campaignId];
    let paramIndex = 2;

    // Apply filters
    if (filters.assigned_to_id) {
      query += ` AND cc.assigned_to_id = $${paramIndex}`;
      params.push(filters.assigned_to_id);
      paramIndex++;
    }
    if (filters.status) {
      query += ` AND cc.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }
    if (filters.tier) {
      query += ` AND cc.tier = $${paramIndex}`;
      params.push(filters.tier);
      paramIndex++;
    }
    if (filters.target_week) {
      query += ` AND cc.target_week = $${paramIndex}`;
      params.push(filters.target_week);
      paramIndex++;
    }

    query += `
      GROUP BY cc.id, u.first_name, u.last_name, c.name
      ORDER BY cc.tier, cc.score DESC, cc.name
    `;

    const result = await db.query(query, params);
    return result.rows;
  },

  // Get company by ID
  getById: async (id) => {
    const query = `
      SELECT
        cc.*,
        CONCAT(u.first_name, ' ', u.last_name) as assigned_to_name,
        c.name as campaign_name,
        comp.name as linked_company_name
      FROM campaign_companies cc
      LEFT JOIN users u ON cc.assigned_to_id = u.id
      LEFT JOIN campaigns c ON cc.campaign_id = c.id
      LEFT JOIN companies comp ON cc.linked_company_id = comp.id
      WHERE cc.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  // Create campaign company
  create: async (data) => {
    const query = `
      INSERT INTO campaign_companies (
        campaign_id, name, sector, address, phone, website, tier, score,
        assigned_to_id, target_week, status, next_action
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const values = [
      data.campaign_id,
      data.name,
      data.sector,
      data.address,
      data.phone,
      data.website || null,
      data.tier || 'B',
      data.score || 70,
      data.assigned_to_id,
      data.target_week || null,
      data.status || 'prospect',
      data.next_action || 'none'
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Update campaign company
  update: async (id, data) => {
    const query = `
      UPDATE campaign_companies
      SET name = COALESCE($1, name),
          sector = COALESCE($2, sector),
          address = COALESCE($3, address),
          phone = COALESCE($4, phone),
          website = COALESCE($5, website),
          tier = COALESCE($6, tier),
          score = COALESCE($7, score),
          assigned_to_id = COALESCE($8, assigned_to_id),
          target_week = COALESCE($9, target_week),
          status = COALESCE($10, status),
          next_action = COALESCE($11, next_action),
          linked_company_id = COALESCE($12, linked_company_id),
          is_added_to_database = COALESCE($13, is_added_to_database)
      WHERE id = $14
      RETURNING *
    `;
    const values = [
      data.name,
      data.sector,
      data.address,
      data.phone,
      data.website,
      data.tier,
      data.score,
      data.assigned_to_id,
      data.target_week,
      data.status,
      data.next_action,
      data.linked_company_id,
      data.is_added_to_database,
      id
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Update status
  updateStatus: async (id, status, userId) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const updateQuery = `
        UPDATE campaign_companies
        SET status = $1
        WHERE id = $2
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [status, id]);
      const company = updateResult.rows[0];

      // Log activity
      const logQuery = `
        INSERT INTO campaign_activity_logs (
          campaign_id, campaign_company_id, user_id, activity_type, description
        )
        VALUES ($1, $2, $3, 'status_change', $4)
      `;
      await client.query(logQuery, [
        company.campaign_id,
        id,
        userId,
        `Status changed to: ${status}`
      ]);

      await client.query('COMMIT');
      return company;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Update next action
  updateAction: async (id, nextAction, userId) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const updateQuery = `
        UPDATE campaign_companies
        SET next_action = $1
        WHERE id = $2
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [nextAction, id]);
      const company = updateResult.rows[0];

      // Log activity
      const logQuery = `
        INSERT INTO campaign_activity_logs (
          campaign_id, campaign_company_id, user_id, activity_type, description
        )
        VALUES ($1, $2, $3, 'action_change', $4)
      `;
      await client.query(logQuery, [
        company.campaign_id,
        id,
        userId,
        `Next action set to: ${nextAction}`
      ]);

      await client.query('COMMIT');
      return company;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Add to main companies database
  addToDatabase: async (campaignCompanyId, userId) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get campaign company details
      const ccQuery = 'SELECT * FROM campaign_companies WHERE id = $1';
      const ccResult = await client.query(ccQuery, [campaignCompanyId]);
      const campaignCompany = ccResult.rows[0];

      if (!campaignCompany) {
        throw new Error('Campaign company not found');
      }

      if (campaignCompany.is_added_to_database) {
        throw new Error('Company already added to database');
      }

      // Create company in main database
      const companyQuery = `
        INSERT INTO companies (name, industry, address, phone, website, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const companyResult = await client.query(companyQuery, [
        campaignCompany.name,
        campaignCompany.sector,
        campaignCompany.address,
        campaignCompany.phone,
        campaignCompany.website,
        userId
      ]);
      const newCompany = companyResult.rows[0];

      // Update campaign company to link to new company
      const updateQuery = `
        UPDATE campaign_companies
        SET linked_company_id = $1, is_added_to_database = true
        WHERE id = $2
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [newCompany.id, campaignCompanyId]);

      // Copy contacts to main database
      const contactsQuery = 'SELECT * FROM campaign_contacts WHERE campaign_company_id = $1';
      const contactsResult = await client.query(contactsQuery, [campaignCompanyId]);

      for (const contact of contactsResult.rows) {
        await client.query(
          `INSERT INTO company_contacts (company_id, name, title, email, phone, is_primary)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [newCompany.id, contact.name, contact.title, contact.email, contact.phone, contact.is_primary]
        );
      }

      // Log activity
      const logQuery = `
        INSERT INTO campaign_activity_logs (
          campaign_id, campaign_company_id, user_id, activity_type, description,
          metadata
        )
        VALUES ($1, $2, $3, 'company_added_to_db', $4, $5)
      `;
      await client.query(logQuery, [
        campaignCompany.campaign_id,
        campaignCompanyId,
        userId,
        `Company added to main database: ${campaignCompany.name}`,
        JSON.stringify({ company_id: newCompany.id })
      ]);

      await client.query('COMMIT');
      return { campaignCompany: updateResult.rows[0], company: newCompany };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Delete campaign company
  delete: async (id) => {
    const query = 'DELETE FROM campaign_companies WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
};

module.exports = campaignCompanies;
