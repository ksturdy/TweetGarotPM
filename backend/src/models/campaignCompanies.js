const db = require('../config/database');

const campaignCompanies = {
  // Get all companies for a campaign
  getByCampaignId: async (campaignId, filters = {}, tenantId = null) => {
    let query = `
      SELECT
        cc.*,
        CONCAT(e.first_name, ' ', e.last_name) as assigned_to_name,
        cust.name as linked_company_name,
        -- Contact count: real customer_contacts if linked, else campaign_contacts
        CASE WHEN cc.linked_company_id IS NOT NULL
          THEN (SELECT COUNT(*) FROM customer_contacts WHERE customer_id = cc.linked_company_id)
          ELSE (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_company_id = cc.id)
        END as contact_count,
        -- Opportunity count: legacy campaign_opportunities + real pipeline opportunities
        (
          (SELECT COUNT(*) FROM campaign_opportunities WHERE campaign_company_id = cc.id) +
          CASE WHEN cc.linked_company_id IS NOT NULL
            THEN (SELECT COUNT(*) FROM opportunities WHERE (customer_id = cc.linked_company_id OR gc_customer_id = cc.linked_company_id OR campaign_id = cc.campaign_id) AND tenant_id = COALESCE($2, cc.campaign_id) AND campaign_id = cc.campaign_id)
            ELSE 0
          END
        ) as opportunity_count,
        -- Opportunity value: legacy + real
        (
          COALESCE((SELECT SUM(value) FROM campaign_opportunities WHERE campaign_company_id = cc.id), 0) +
          CASE WHEN cc.linked_company_id IS NOT NULL
            THEN COALESCE((SELECT SUM(estimated_value) FROM opportunities WHERE (customer_id = cc.linked_company_id OR gc_customer_id = cc.linked_company_id) AND campaign_id = cc.campaign_id AND tenant_id = COALESCE($2, 0)), 0)
            ELSE 0
          END
        ) as total_opportunity_value
      FROM campaign_companies cc
      LEFT JOIN employees e ON cc.assigned_to_id = e.id
      LEFT JOIN customers cust ON cc.linked_company_id = cust.id
      WHERE cc.campaign_id = $1
    `;

    const params = [campaignId, tenantId];
    let paramIndex = 3;

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
        CONCAT(e.first_name, ' ', e.last_name) as assigned_to_name,
        c.name as campaign_name,
        comp.name as linked_company_name
      FROM campaign_companies cc
      LEFT JOIN employees e ON cc.assigned_to_id = e.id
      LEFT JOIN campaigns c ON cc.campaign_id = c.id
      LEFT JOIN customers comp ON cc.linked_company_id = comp.id
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
        assigned_to_id, target_week, status, next_action, source, linked_company_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
      data.next_action || 'none',
      data.source || 'manual',
      data.linked_company_id || null
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

  // Update assigned team member
  updateAssignment: async (id, assignedToId, userId) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get old assignment name for logging
      const oldQuery = `
        SELECT cc.*, CONCAT(e.first_name, ' ', e.last_name) as old_assigned_name
        FROM campaign_companies cc
        LEFT JOIN employees e ON cc.assigned_to_id = e.id
        WHERE cc.id = $1
      `;
      const oldResult = await client.query(oldQuery, [id]);
      const company = oldResult.rows[0];

      const updateQuery = `
        UPDATE campaign_companies
        SET assigned_to_id = $1
        WHERE id = $2
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [assignedToId, id]);

      // Get new assignment name for logging
      const newNameQuery = `SELECT CONCAT(first_name, ' ', last_name) as name FROM employees WHERE id = $1`;
      const newNameResult = await client.query(newNameQuery, [assignedToId]);
      const newName = newNameResult.rows[0]?.name || 'Unknown';

      // Log activity
      const logQuery = `
        INSERT INTO campaign_activity_logs (
          campaign_id, campaign_company_id, user_id, activity_type, description
        )
        VALUES ($1, $2, $3, 'reassignment', $4)
      `;
      await client.query(logQuery, [
        company.campaign_id,
        id,
        userId,
        `Reassigned from ${company.old_assigned_name || 'Unassigned'} to ${newName}`
      ]);

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Update target week
  updateTargetWeek: async (id, newWeek, userId) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get current company and old week label
      const oldQuery = `
        SELECT cc.*, cw.label as old_week_label
        FROM campaign_companies cc
        LEFT JOIN campaign_weeks cw ON cw.campaign_id = cc.campaign_id AND cw.week_number = cc.target_week
        WHERE cc.id = $1
      `;
      const oldResult = await client.query(oldQuery, [id]);
      const company = oldResult.rows[0];
      const oldWeek = company.target_week;

      // Update target_week
      const updateResult = await client.query(
        'UPDATE campaign_companies SET target_week = $1 WHERE id = $2 RETURNING *',
        [newWeek, id]
      );

      // Get new week label
      const newWeekResult = await client.query(
        'SELECT label FROM campaign_weeks WHERE campaign_id = $1 AND week_number = $2',
        [company.campaign_id, newWeek]
      );
      const newWeekLabel = newWeekResult.rows[0]?.label || `Week ${newWeek}`;
      const oldWeekLabel = company.old_week_label || (oldWeek ? `Week ${oldWeek}` : 'Unscheduled');

      // Log activity with metadata for goal tracking
      await client.query(
        `INSERT INTO campaign_activity_logs (
          campaign_id, campaign_company_id, user_id, activity_type, description, metadata
        ) VALUES ($1, $2, $3, 'week_reassignment', $4, $5)`,
        [
          company.campaign_id,
          id,
          userId,
          `Moved from ${oldWeekLabel} to ${newWeekLabel}`,
          JSON.stringify({ from_week: oldWeek, to_week: newWeek })
        ]
      );

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Add to main customers database
  addToDatabase: async (campaignCompanyId, userId, tenantId) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Get campaign company details (with tenant_id from campaign)
      const ccQuery = `
        SELECT cc.*, c.tenant_id
        FROM campaign_companies cc
        JOIN campaigns c ON cc.campaign_id = c.id
        WHERE cc.id = $1
      `;
      const ccResult = await client.query(ccQuery, [campaignCompanyId]);
      const campaignCompany = ccResult.rows[0];

      if (!campaignCompany) {
        throw new Error('Campaign company not found');
      }

      if (campaignCompany.is_added_to_database) {
        throw new Error('Company already added to database');
      }

      const effectiveTenantId = tenantId || campaignCompany.tenant_id;

      // Create as prospect in main database (can be merged into a Vista customer later)
      const customerQuery = `
        INSERT INTO customers (name, market, address, active_customer, source, customer_type, tenant_id)
        VALUES ($1, $2, $3, true, 'manual', 'prospect', $4)
        RETURNING *
      `;
      const customerResult = await client.query(customerQuery, [
        campaignCompany.name,
        campaignCompany.sector,
        campaignCompany.address,
        effectiveTenantId
      ]);
      const newCustomer = customerResult.rows[0];

      // Update campaign company to link to new customer
      const updateQuery = `
        UPDATE campaign_companies
        SET linked_company_id = $1, is_added_to_database = true
        WHERE id = $2
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [newCustomer.id, campaignCompanyId]);

      // Copy contacts to customer_contacts
      const contactsQuery = 'SELECT * FROM campaign_contacts WHERE campaign_company_id = $1';
      const contactsResult = await client.query(contactsQuery, [campaignCompanyId]);

      for (const contact of contactsResult.rows) {
        const nameParts = (contact.name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        await client.query(
          `INSERT INTO customer_contacts (customer_id, first_name, last_name, title, email, phone, is_primary, tenant_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [newCustomer.id, firstName, lastName, contact.title, contact.email, contact.phone, contact.is_primary, effectiveTenantId]
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
        JSON.stringify({ customer_id: newCustomer.id })
      ]);

      await client.query('COMMIT');
      return { campaignCompany: updateResult.rows[0], customer: newCustomer };
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
