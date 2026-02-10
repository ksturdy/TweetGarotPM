const db = require('../config/database');

const campaigns = {
  // Get all campaigns for tenant
  getAll: async (tenantId) => {
    const query = `
      SELECT
        c.*,
        CONCAT(e.first_name, ' ', e.last_name) as owner_name,
        COUNT(DISTINCT cc.id) as company_count,
        COUNT(DISTINCT CASE WHEN cc.status != 'prospect' THEN cc.id END) as contacted,
        COUNT(DISTINCT co.id) as opportunities,
        COALESCE(SUM(co.value), 0) as pipeline_value
      FROM campaigns c
      LEFT JOIN employees e ON c.owner_id = e.id
      LEFT JOIN campaign_companies cc ON c.id = cc.campaign_id
      LEFT JOIN campaign_opportunities co ON cc.id = co.campaign_company_id
      WHERE c.tenant_id = $1
      GROUP BY c.id, e.first_name, e.last_name
      ORDER BY c.created_at DESC
    `;
    const result = await db.query(query, [tenantId]);
    return result.rows;
  },

  // Get campaign by ID (global)
  getById: async (id) => {
    const query = `
      SELECT
        c.*,
        CONCAT(e.first_name, ' ', e.last_name) as owner_name,
        e.email as owner_email,
        COUNT(DISTINCT cc.id) as company_count,
        COUNT(DISTINCT CASE WHEN cc.status != 'prospect' THEN cc.id END) as contacted,
        COUNT(DISTINCT co.id) as opportunities,
        COALESCE(SUM(co.value), 0) as pipeline_value
      FROM campaigns c
      LEFT JOIN employees e ON c.owner_id = e.id
      LEFT JOIN campaign_companies cc ON c.id = cc.campaign_id
      LEFT JOIN campaign_opportunities co ON cc.id = co.campaign_company_id
      WHERE c.id = $1
      GROUP BY c.id, e.first_name, e.last_name, e.email
    `;
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  // Get campaign by ID with tenant check
  getByIdAndTenant: async (id, tenantId) => {
    const query = `
      SELECT
        c.*,
        CONCAT(e.first_name, ' ', e.last_name) as owner_name,
        e.email as owner_email,
        COUNT(DISTINCT cc.id) as company_count,
        COUNT(DISTINCT CASE WHEN cc.status != 'prospect' THEN cc.id END) as contacted,
        COUNT(DISTINCT co.id) as opportunities,
        COALESCE(SUM(co.value), 0) as pipeline_value
      FROM campaigns c
      LEFT JOIN employees e ON c.owner_id = e.id
      LEFT JOIN campaign_companies cc ON c.id = cc.campaign_id
      LEFT JOIN campaign_opportunities co ON cc.id = co.campaign_company_id
      WHERE c.id = $1 AND c.tenant_id = $2
      GROUP BY c.id, e.first_name, e.last_name, e.email
    `;
    const result = await db.query(query, [id, tenantId]);
    return result.rows[0];
  },

  // Count campaigns in tenant
  countByTenant: async (tenantId) => {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM campaigns WHERE tenant_id = $1',
      [tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  // Create campaign
  create: async (data, tenantId) => {
    const query = `
      INSERT INTO campaigns (
        name, description, start_date, end_date, status, owner_id, total_targets,
        target_touchpoints, target_opportunities, target_estimates, target_awards,
        target_pipeline_value, goal_description, tenant_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const values = [
      data.name,
      data.description,
      data.start_date,
      data.end_date,
      data.status || 'planning',
      data.owner_id,
      data.total_targets || 0,
      data.target_touchpoints || 0,
      data.target_opportunities || 0,
      data.target_estimates || 0,
      data.target_awards || 0,
      data.target_pipeline_value || 0,
      data.goal_description || null,
      tenantId
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Update campaign with tenant check
  update: async (id, data, tenantId) => {
    const query = `
      UPDATE campaigns
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          start_date = COALESCE($3, start_date),
          end_date = COALESCE($4, end_date),
          status = COALESCE($5, status),
          owner_id = COALESCE($6, owner_id),
          total_targets = COALESCE($7, total_targets),
          target_touchpoints = COALESCE($10, target_touchpoints),
          target_opportunities = COALESCE($11, target_opportunities),
          target_estimates = COALESCE($12, target_estimates),
          target_awards = COALESCE($13, target_awards),
          target_pipeline_value = COALESCE($14, target_pipeline_value),
          goal_description = COALESCE($15, goal_description)
      WHERE id = $8 AND tenant_id = $9
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
      id,
      tenantId,
      data.target_touchpoints,
      data.target_opportunities,
      data.target_estimates,
      data.target_awards,
      data.target_pipeline_value,
      data.goal_description
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Delete campaign with tenant check
  delete: async (id, tenantId) => {
    const query = 'DELETE FROM campaigns WHERE id = $1 AND tenant_id = $2 RETURNING *';
    const result = await db.query(query, [id, tenantId]);
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

  // Get team members for campaign (joined to employees table)
  getTeamMembers: async (campaignId) => {
    const query = `
      SELECT
        ctm.*,
        CONCAT(e.first_name, ' ', e.last_name) as name,
        e.email,
        e.job_title,
        d.name as department_name,
        COUNT(DISTINCT cc.id) as assigned_companies,
        COUNT(DISTINCT CASE WHEN cc.status != 'prospect' THEN cc.id END) as contacted_companies
      FROM campaign_team_members ctm
      JOIN employees e ON ctm.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN campaign_companies cc ON cc.campaign_id = ctm.campaign_id AND cc.assigned_to_id = ctm.employee_id
      WHERE ctm.campaign_id = $1
      GROUP BY ctm.id, e.first_name, e.last_name, e.email, e.job_title, d.name
      ORDER BY ctm.role, e.first_name, e.last_name
    `;
    const result = await db.query(query, [campaignId]);
    return result.rows;
  },

  // Add team member by employee_id
  addTeamMember: async (campaignId, employeeId, role = 'member') => {
    // Look up user_id from the employee record (may be null)
    const empResult = await db.query('SELECT user_id FROM employees WHERE id = $1', [employeeId]);
    const userId = empResult.rows[0]?.user_id || null;

    const query = `
      INSERT INTO campaign_team_members (campaign_id, employee_id, user_id, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (campaign_id, employee_id)
      DO UPDATE SET role = $4
      RETURNING *
    `;
    const result = await db.query(query, [campaignId, employeeId, userId, role]);
    return result.rows[0];
  },

  // Remove team member
  removeTeamMember: async (campaignId, employeeId) => {
    const query = 'DELETE FROM campaign_team_members WHERE campaign_id = $1 AND employee_id = $2 RETURNING *';
    const result = await db.query(query, [campaignId, employeeId]);
    return result.rows[0];
  },

  // Reassign all companies from one employee to another within a campaign
  reassignCompanies: async (campaignId, fromEmployeeId, toEmployeeId) => {
    const query = `
      UPDATE campaign_companies
      SET assigned_to_id = $1
      WHERE campaign_id = $2 AND assigned_to_id = $3
      RETURNING *
    `;
    const result = await db.query(query, [toEmployeeId, campaignId, fromEmployeeId]);
    return result.rows;
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

  // Generate campaign: auto-create weeks from dates, distribute prospects to team
  generate: async (campaignId, tenantId) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get campaign
      const campaignResult = await client.query(
        'SELECT * FROM campaigns WHERE id = $1 AND tenant_id = $2',
        [campaignId, tenantId]
      );
      const campaign = campaignResult.rows[0];
      if (!campaign) throw new Error('Campaign not found');

      // 2. Auto-generate weeks from start_date to end_date
      const start = new Date(campaign.start_date);
      const end = new Date(campaign.end_date);
      let weekNumber = 1;
      let weekStart = new Date(start);
      while (weekStart < end) {
        let weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > end) weekEnd = new Date(end);

        const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          + ' - ' + weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        await client.query(
          `INSERT INTO campaign_weeks (campaign_id, week_number, start_date, end_date, label)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (campaign_id, week_number) DO NOTHING`,
          [campaignId, weekNumber, weekStart.toISOString().slice(0, 10), weekEnd.toISOString().slice(0, 10), label]
        );

        weekStart.setDate(weekStart.getDate() + 7);
        weekNumber++;
      }
      const totalWeeks = weekNumber - 1;

      // 3. Get team members and companies (ordered by tier then score DESC)
      const teamResult = await client.query(
        'SELECT * FROM campaign_team_members WHERE campaign_id = $1',
        [campaignId]
      );
      const companiesResult = await client.query(
        'SELECT * FROM campaign_companies WHERE campaign_id = $1 ORDER BY tier ASC, score DESC',
        [campaignId]
      );

      const teamMembers = teamResult.rows;
      const companies = companiesResult.rows;

      // 4. Round-robin distribute unassigned companies to team members across weeks
      if (teamMembers.length > 0 && companies.length > 0) {
        let memberIdx = 0;
        const companiesPerWeek = Math.ceil(companies.length / totalWeeks);

        for (let i = 0; i < companies.length; i++) {
          const company = companies[i];
          if (!company.assigned_to_id) {
            const targetWeek = Math.min(Math.floor(i / companiesPerWeek) + 1, totalWeeks);
            await client.query(
              'UPDATE campaign_companies SET assigned_to_id = $1, target_week = $2 WHERE id = $3',
              [teamMembers[memberIdx % teamMembers.length].employee_id, targetWeek, company.id]
            );
            memberIdx++;
          }
        }

        // 5. Update target_count for each team member
        for (const member of teamMembers) {
          const countResult = await client.query(
            'SELECT COUNT(*) as count FROM campaign_companies WHERE campaign_id = $1 AND assigned_to_id = $2',
            [campaignId, member.employee_id]
          );
          await client.query(
            'UPDATE campaign_team_members SET target_count = $1 WHERE id = $2',
            [parseInt(countResult.rows[0].count), member.id]
          );
        }
      }

      // 6. Update campaign total_targets and status
      await client.query(
        'UPDATE campaigns SET total_targets = $1, status = $2 WHERE id = $3',
        [companies.length, 'active', campaignId]
      );

      await client.query('COMMIT');
      return { weeks: totalWeeks, companies: companies.length, team: teamMembers.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Bulk create campaign companies
  bulkCreateCompanies: async (campaignId, companiesArray) => {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const created = [];
      for (const data of companiesArray) {
        const result = await client.query(
          `INSERT INTO campaign_companies (
            campaign_id, name, sector, address, phone, website, tier, score,
            assigned_to_id, target_week, status, next_action
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [campaignId, data.name, data.sector || null, data.address || null, data.phone || null,
           data.website || null, data.tier || 'B', data.score || 70,
           data.assigned_to_id || null, data.target_week || null,
           'prospect', 'none']
        );
        created.push(result.rows[0]);
      }
      await client.query('COMMIT');
      return created;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
