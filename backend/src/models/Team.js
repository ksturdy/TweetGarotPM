const db = require('../config/database');

class Team {
  /**
   * Get all teams within a tenant
   */
  static async getAll(tenantId) {
    const result = await db.query(`
      SELECT t.*,
             e.first_name || ' ' || e.last_name as team_lead_name,
             (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
      FROM teams t
      LEFT JOIN employees e ON t.team_lead_id = e.id
      WHERE t.tenant_id = $1
      ORDER BY t.name ASC
    `, [tenantId]);
    return result.rows;
  }

  /**
   * Get team by ID with tenant check
   */
  static async getByIdAndTenant(id, tenantId) {
    const result = await db.query(`
      SELECT t.*,
             e.first_name || ' ' || e.last_name as team_lead_name
      FROM teams t
      LEFT JOIN employees e ON t.team_lead_id = e.id
      WHERE t.id = $1 AND t.tenant_id = $2
    `, [id, tenantId]);
    return result.rows[0];
  }

  /**
   * Create a new team
   */
  static async create(data, tenantId) {
    const result = await db.query(`
      INSERT INTO teams (name, description, team_lead_id, color, is_active, tenant_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      data.name,
      data.description || null,
      data.team_lead_id || null,
      data.color || '#3b82f6',
      data.is_active !== false,
      tenantId,
      data.created_by || null
    ]);
    return result.rows[0];
  }

  /**
   * Update a team
   * When team_lead_id changes, also syncs team_members roles.
   */
  static async update(id, data, tenantId) {
    const result = await db.query(`
      UPDATE teams SET
        name = COALESCE($1, name),
        description = $2,
        team_lead_id = $3,
        color = COALESCE($4, color),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND tenant_id = $7
      RETURNING *
    `, [
      data.name,
      data.description,
      data.team_lead_id,
      data.color,
      data.is_active,
      id,
      tenantId
    ]);

    if (result.rows.length > 0 && data.team_lead_id) {
      // Demote all current leads in team_members
      await db.query(`
        UPDATE team_members SET role = 'member'
        WHERE team_id = $1 AND role = 'lead'
      `, [id]);
      // Promote the new lead (if they're a member)
      await db.query(`
        UPDATE team_members SET role = 'lead'
        WHERE team_id = $1 AND employee_id = $2
      `, [id, data.team_lead_id]);
    } else if (result.rows.length > 0 && !data.team_lead_id) {
      // Lead was cleared — demote all leads in team_members
      await db.query(`
        UPDATE team_members SET role = 'member'
        WHERE team_id = $1 AND role = 'lead'
      `, [id]);
    }

    return result.rows[0];
  }

  /**
   * Delete a team
   */
  static async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM teams WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    return result.rows.length > 0;
  }

  /**
   * Count teams in a tenant
   */
  static async countByTenant(tenantId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM teams WHERE tenant_id = $1',
      [tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get team members with employee details
   */
  static async getMembers(teamId, tenantId) {
    const result = await db.query(`
      SELECT tm.*,
             e.first_name, e.last_name, e.email, e.job_title,
             e.department_id, d.name as department_name,
             e.user_id
      FROM team_members tm
      JOIN employees e ON tm.employee_id = e.id
      LEFT JOIN departments d ON e.department_id = d.id
      JOIN teams t ON tm.team_id = t.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE tm.team_id = $1 AND t.tenant_id = $2
        AND (e.user_id IS NULL OR u.is_active = true)
      ORDER BY tm.role = 'lead' DESC, e.last_name ASC
    `, [teamId, tenantId]);
    return result.rows;
  }

  /**
   * Add member to team
   * When adding with role 'lead', also updates teams.team_lead_id to keep them in sync.
   */
  static async addMember(teamId, employeeId, role = 'member') {
    const result = await db.query(`
      INSERT INTO team_members (team_id, employee_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (team_id, employee_id) DO UPDATE SET role = $3
      RETURNING *
    `, [teamId, employeeId, role]);

    if (result.rows.length > 0 && role === 'lead') {
      // Sync teams.team_lead_id
      await db.query('UPDATE teams SET team_lead_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [employeeId, teamId]);
      // Demote any other leads in team_members to 'member'
      await db.query(`
        UPDATE team_members SET role = 'member'
        WHERE team_id = $1 AND employee_id != $2 AND role = 'lead'
      `, [teamId, employeeId]);
    }

    return result.rows[0];
  }

  /**
   * Remove member from team
   */
  static async removeMember(teamId, employeeId) {
    const result = await db.query(
      'DELETE FROM team_members WHERE team_id = $1 AND employee_id = $2 RETURNING id',
      [teamId, employeeId]
    );
    return result.rows.length > 0;
  }

  /**
   * Update member role
   * When setting role to 'lead', also updates teams.team_lead_id to keep them in sync.
   * When demoting a lead, clears team_lead_id if it matches this employee.
   */
  static async updateMemberRole(teamId, employeeId, role) {
    const result = await db.query(`
      UPDATE team_members SET role = $1
      WHERE team_id = $2 AND employee_id = $3
      RETURNING *
    `, [role, teamId, employeeId]);

    if (result.rows.length > 0) {
      if (role === 'lead') {
        // Sync teams.team_lead_id
        await db.query('UPDATE teams SET team_lead_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [employeeId, teamId]);
        // Demote any other leads in team_members to 'member'
        await db.query(`
          UPDATE team_members SET role = 'member'
          WHERE team_id = $1 AND employee_id != $2 AND role = 'lead'
        `, [teamId, employeeId]);
      } else {
        // Demoting from lead — clear team_lead_id if it was this employee
        await db.query(`
          UPDATE teams SET team_lead_id = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND team_lead_id = $2
        `, [teamId, employeeId]);
      }
    }

    return result.rows[0];
  }

  /**
   * Get all employee IDs from the user's team.
   * Priority: if the user leads a team, "My Team" = only those teams they lead.
   * Fallback: if not a lead, use teams they're a member of.
   * Used for "My Team" filtering on the dashboard.
   */
  static async getMyTeamMemberEmployeeIds(userId, tenantId) {
    // First, get the user's employee_id
    const empResult = await db.query(
      'SELECT id FROM employees WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (empResult.rows.length === 0) {
      return []; // User has no employee record
    }

    const employeeId = empResult.rows[0].id;

    // Check if user leads any active teams
    const leadsTeams = await db.query(
      'SELECT id FROM teams WHERE team_lead_id = $1 AND tenant_id = $2 AND is_active = true',
      [employeeId, tenantId]
    );

    if (leadsTeams.rows.length > 0) {
      // User leads team(s) — "My Team" = only members of those teams + the lead
      const result = await db.query(`
        SELECT DISTINCT employee_id FROM (
          -- All members of teams where user is the team lead
          SELECT tm.employee_id
          FROM teams t
          JOIN team_members tm ON tm.team_id = t.id
          WHERE t.team_lead_id = $1 AND t.tenant_id = $2 AND t.is_active = true

          UNION

          -- The team lead themselves
          SELECT t.team_lead_id as employee_id
          FROM teams t
          WHERE t.team_lead_id = $1 AND t.tenant_id = $2 AND t.is_active = true
        ) combined
        WHERE employee_id IS NOT NULL
      `, [employeeId, tenantId]);

      return result.rows.map(r => r.employee_id);
    }

    // Fallback: user doesn't lead any team — use teams they're a member of
    const result = await db.query(`
      SELECT DISTINCT employee_id FROM (
        -- All members of teams where user is a member
        SELECT tm2.employee_id
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN team_members tm2 ON tm2.team_id = t.id
        WHERE tm.employee_id = $1 AND t.tenant_id = $2 AND t.is_active = true

        UNION

        -- Team lead of those teams
        SELECT t.team_lead_id as employee_id
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.employee_id = $1 AND t.tenant_id = $2 AND t.is_active = true AND t.team_lead_id IS NOT NULL
      ) combined
      WHERE employee_id IS NOT NULL
    `, [employeeId, tenantId]);

    return result.rows.map(r => r.employee_id);
  }

  /**
   * Get user IDs for team members of the user's team.
   * Priority: if the user leads a team, use only those teams.
   * Fallback: if not a lead, use teams they're a member of.
   * Uses user_id link, email matching, and name matching as fallbacks.
   */
  static async getMyTeamMemberUserIds(userId, tenantId) {
    // First, get the user's employee_id
    const empResult = await db.query(
      'SELECT id FROM employees WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (empResult.rows.length === 0) {
      return []; // User has no employee record
    }

    const employeeId = empResult.rows[0].id;

    // Check if user leads any active teams
    const leadsTeams = await db.query(
      'SELECT id FROM teams WHERE team_lead_id = $1 AND tenant_id = $2 AND is_active = true',
      [employeeId, tenantId]
    );

    if (leadsTeams.rows.length > 0) {
      // User leads team(s) — "My Team" = only members of those teams + the lead
      const result = await db.query(`
        SELECT DISTINCT user_id FROM (
          -- Members of teams user leads (via user_id link)
          SELECT e.user_id
          FROM teams t
          JOIN team_members tm ON tm.team_id = t.id
          JOIN employees e ON tm.employee_id = e.id
          WHERE t.team_lead_id = $1 AND t.tenant_id = $2 AND t.is_active = true AND e.user_id IS NOT NULL

          UNION

          -- Members of teams user leads (via email match)
          SELECT u.id as user_id
          FROM teams t
          JOIN team_members tm ON tm.team_id = t.id
          JOIN employees e ON tm.employee_id = e.id AND e.tenant_id = $2
          JOIN users u ON LOWER(e.email) = LOWER(u.email) AND u.tenant_id = $2
          WHERE t.team_lead_id = $1 AND t.tenant_id = $2 AND t.is_active = true

          UNION

          -- Members of teams user leads (via name match)
          SELECT u.id as user_id
          FROM teams t
          JOIN team_members tm ON tm.team_id = t.id
          JOIN employees e ON tm.employee_id = e.id AND e.tenant_id = $2
          JOIN users u ON LOWER(e.first_name) = LOWER(u.first_name) AND LOWER(e.last_name) = LOWER(u.last_name) AND u.tenant_id = $2
          WHERE t.team_lead_id = $1 AND t.tenant_id = $2 AND t.is_active = true

          UNION

          -- The team lead themselves
          SELECT e.user_id
          FROM teams t
          JOIN employees e ON t.team_lead_id = e.id
          WHERE t.team_lead_id = $1 AND t.tenant_id = $2 AND t.is_active = true AND e.user_id IS NOT NULL
        ) combined
        WHERE user_id IS NOT NULL
      `, [employeeId, tenantId]);

      return result.rows.map(r => r.user_id);
    }

    // Fallback: user doesn't lead any team — use teams they're a member of
    const result = await db.query(`
      SELECT DISTINCT user_id FROM (
        -- All members of teams where user is a member (via user_id link)
        SELECT e.user_id
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN team_members tm2 ON tm2.team_id = t.id
        JOIN employees e ON tm2.employee_id = e.id
        WHERE tm.employee_id = $1 AND t.tenant_id = $2 AND t.is_active = true AND e.user_id IS NOT NULL

        UNION

        -- All members via email match
        SELECT u.id as user_id
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN team_members tm2 ON tm2.team_id = t.id
        JOIN employees e ON tm2.employee_id = e.id AND e.tenant_id = $2
        JOIN users u ON LOWER(e.email) = LOWER(u.email) AND u.tenant_id = $2
        WHERE tm.employee_id = $1 AND t.tenant_id = $2 AND t.is_active = true

        UNION

        -- All members via name match
        SELECT u.id as user_id
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN team_members tm2 ON tm2.team_id = t.id
        JOIN employees e ON tm2.employee_id = e.id AND e.tenant_id = $2
        JOIN users u ON LOWER(e.first_name) = LOWER(u.first_name) AND LOWER(e.last_name) = LOWER(u.last_name) AND u.tenant_id = $2
        WHERE tm.employee_id = $1 AND t.tenant_id = $2 AND t.is_active = true

        UNION

        -- Team lead of those teams (via user_id link)
        SELECT e.user_id
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN employees e ON t.team_lead_id = e.id
        WHERE tm.employee_id = $1 AND t.tenant_id = $2 AND t.is_active = true AND t.team_lead_id IS NOT NULL AND e.user_id IS NOT NULL

        UNION

        -- Team lead via email match
        SELECT u.id as user_id
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN employees e ON t.team_lead_id = e.id AND e.tenant_id = $2
        JOIN users u ON LOWER(e.email) = LOWER(u.email) AND u.tenant_id = $2
        WHERE tm.employee_id = $1 AND t.tenant_id = $2 AND t.is_active = true AND t.team_lead_id IS NOT NULL

        UNION

        -- Team lead via name match
        SELECT u.id as user_id
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN employees e ON t.team_lead_id = e.id AND e.tenant_id = $2
        JOIN users u ON LOWER(e.first_name) = LOWER(u.first_name) AND LOWER(e.last_name) = LOWER(u.last_name) AND u.tenant_id = $2
        WHERE tm.employee_id = $1 AND t.tenant_id = $2 AND t.is_active = true AND t.team_lead_id IS NOT NULL
      ) combined
      WHERE user_id IS NOT NULL
    `, [employeeId, tenantId]);

    return result.rows.map(r => r.user_id);
  }

  /**
   * Get full names for team members of the user's team.
   * Priority: if the user leads a team, use only those teams.
   * Fallback: if not a lead, use teams they're a member of.
   * Used for matching estimates by estimator_name text field.
   */
  static async getMyTeamMemberNames(userId, tenantId) {
    // First, get the user's employee_id
    const empResult = await db.query(
      'SELECT id FROM employees WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (empResult.rows.length === 0) {
      return []; // User has no employee record
    }

    const employeeId = empResult.rows[0].id;

    // Check if user leads any active teams
    const leadsTeams = await db.query(
      'SELECT id FROM teams WHERE team_lead_id = $1 AND tenant_id = $2 AND is_active = true',
      [employeeId, tenantId]
    );

    if (leadsTeams.rows.length > 0) {
      // User leads team(s) — "My Team" = only members of those teams + the lead
      const result = await db.query(`
        SELECT DISTINCT full_name FROM (
          -- All members of teams where user is the team lead
          SELECT e.first_name || ' ' || e.last_name as full_name
          FROM teams t
          JOIN team_members tm ON tm.team_id = t.id
          JOIN employees e ON tm.employee_id = e.id
          WHERE t.team_lead_id = $1 AND t.tenant_id = $2 AND t.is_active = true

          UNION

          -- The team lead themselves
          SELECT e.first_name || ' ' || e.last_name as full_name
          FROM teams t
          JOIN employees e ON t.team_lead_id = e.id
          WHERE t.team_lead_id = $1 AND t.tenant_id = $2 AND t.is_active = true
        ) combined
        WHERE full_name IS NOT NULL
      `, [employeeId, tenantId]);

      return result.rows.map(r => r.full_name);
    }

    // Fallback: user doesn't lead any team — use teams they're a member of
    const result = await db.query(`
      SELECT DISTINCT full_name FROM (
        -- All members of teams where user is a member
        SELECT e.first_name || ' ' || e.last_name as full_name
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN team_members tm2 ON tm2.team_id = t.id
        JOIN employees e ON tm2.employee_id = e.id
        WHERE tm.employee_id = $1 AND t.tenant_id = $2 AND t.is_active = true

        UNION

        -- Team lead of those teams
        SELECT e.first_name || ' ' || e.last_name as full_name
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN employees e ON t.team_lead_id = e.id
        WHERE tm.employee_id = $1 AND t.tenant_id = $2 AND t.is_active = true AND t.team_lead_id IS NOT NULL
      ) combined
      WHERE full_name IS NOT NULL
    `, [employeeId, tenantId]);

    return result.rows.map(r => r.full_name);
  }

  /**
   * Get team member user IDs (for filtering related entities)
   * Includes both team members AND the team lead
   * Uses user_id link, email matching, and name matching as fallbacks
   */
  static async getMemberUserIds(teamId, tenantId) {
    const result = await db.query(`
      SELECT DISTINCT user_id FROM (
        -- Team members via user_id link
        SELECT u.id as user_id
        FROM team_members tm
        JOIN employees e ON tm.employee_id = e.id AND e.tenant_id = $2
        JOIN users u ON e.user_id = u.id AND u.tenant_id = $2
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.team_id = $1 AND t.tenant_id = $2

        UNION

        -- Team members via email match
        SELECT u.id as user_id
        FROM team_members tm
        JOIN employees e ON tm.employee_id = e.id AND e.tenant_id = $2
        JOIN users u ON LOWER(e.email) = LOWER(u.email) AND u.tenant_id = $2
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.team_id = $1 AND t.tenant_id = $2

        UNION

        -- Team members via name match (handles multiple user accounts with same name)
        SELECT u.id as user_id
        FROM team_members tm
        JOIN employees e ON tm.employee_id = e.id AND e.tenant_id = $2
        JOIN users u ON LOWER(e.first_name) = LOWER(u.first_name)
                    AND LOWER(e.last_name) = LOWER(u.last_name)
                    AND u.tenant_id = $2
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.team_id = $1 AND t.tenant_id = $2

        UNION

        -- Team lead via user_id link
        SELECT u.id as user_id
        FROM teams t
        JOIN employees e ON t.team_lead_id = e.id AND e.tenant_id = $2
        JOIN users u ON e.user_id = u.id AND u.tenant_id = $2
        WHERE t.id = $1 AND t.tenant_id = $2 AND t.team_lead_id IS NOT NULL

        UNION

        -- Team lead via email match
        SELECT u.id as user_id
        FROM teams t
        JOIN employees e ON t.team_lead_id = e.id AND e.tenant_id = $2
        JOIN users u ON LOWER(e.email) = LOWER(u.email) AND u.tenant_id = $2
        WHERE t.id = $1 AND t.tenant_id = $2 AND t.team_lead_id IS NOT NULL

        UNION

        -- Team lead via name match (handles multiple user accounts with same name)
        SELECT u.id as user_id
        FROM teams t
        JOIN employees e ON t.team_lead_id = e.id AND e.tenant_id = $2
        JOIN users u ON LOWER(e.first_name) = LOWER(u.first_name)
                    AND LOWER(e.last_name) = LOWER(u.last_name)
                    AND u.tenant_id = $2
        WHERE t.id = $1 AND t.tenant_id = $2 AND t.team_lead_id IS NOT NULL
      ) combined
      WHERE user_id IS NOT NULL
    `, [teamId, tenantId]);
    return result.rows.map(r => r.user_id);
  }

  /**
   * Get team member names (for matching account_manager field)
   * Includes both team members AND the team lead
   */
  static async getMemberNames(teamId, tenantId) {
    const result = await db.query(`
      SELECT DISTINCT full_name FROM (
        -- Team members
        SELECT e.first_name || ' ' || e.last_name as full_name
        FROM team_members tm
        JOIN employees e ON tm.employee_id = e.id AND e.tenant_id = $2
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.team_id = $1 AND t.tenant_id = $2

        UNION

        -- Team lead
        SELECT e.first_name || ' ' || e.last_name as full_name
        FROM teams t
        JOIN employees e ON t.team_lead_id = e.id AND e.tenant_id = $2
        WHERE t.id = $1 AND t.tenant_id = $2 AND t.team_lead_id IS NOT NULL
      ) combined
      WHERE full_name IS NOT NULL
    `, [teamId, tenantId]);
    return result.rows.map(r => r.full_name);
  }

  /**
   * Get team member employee IDs (for filtering opportunities/estimates which reference employees)
   * Includes both team members AND the team lead
   */
  static async getMemberEmployeeIds(teamId, tenantId) {
    const result = await db.query(`
      SELECT DISTINCT employee_id FROM (
        SELECT tm.employee_id
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE tm.team_id = $1 AND t.tenant_id = $2

        UNION

        SELECT t.team_lead_id as employee_id
        FROM teams t
        WHERE t.id = $1 AND t.tenant_id = $2 AND t.team_lead_id IS NOT NULL
      ) combined
      WHERE employee_id IS NOT NULL
    `, [teamId, tenantId]);
    return result.rows.map(r => r.employee_id);
  }

  /**
   * Get team dashboard metrics
   * @param {string} filter - 'active' (default) or 'all'
   */
  static async getDashboardMetrics(teamId, tenantId, statuses = ['Open']) {
    const employeeIds = await this.getMemberEmployeeIds(teamId, tenantId);
    const memberNames = await this.getMemberNames(teamId, tenantId);

    // Default metrics if no members
    if (employeeIds.length === 0 && memberNames.length === 0) {
      return {
        opportunities: { total: 0, total_value: 0, won: 0, won_value: 0 },
        customers: { total: 0, active: 0 },
        estimates: { total: 0, total_value: 0, pending: 0, won: 0 },
        projects: { total: 0, active: 0, total_value: 0 }
      };
    }

    // activeOnly drives the opp/customer/estimate pipeline filters (unchanged semantics)
    const activeOnly = statuses.length === 1 && statuses[0] === 'Open';

    // Get opportunities metrics (assigned_to references employees)
    // Active = not converted to project (still in pipeline)
    let opportunitiesResult = { rows: [{ total: 0, total_value: 0, won: 0, won_value: 0, weighted_value: 0 }] };
    if (employeeIds.length > 0) {
      const oppFilter = activeOnly
        ? ` AND ps.name NOT IN ('Lost', 'Passed')
            AND NOT (ps.name = 'Awarded' AND o.awarded_status IS NOT NULL AND o.awarded_status IN ('In Progress', 'Completed'))`
        : '';
      opportunitiesResult = await db.query(`
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(o.estimated_value), 0) as total_value,
          COUNT(CASE WHEN o.converted_to_project_id IS NOT NULL THEN 1 END) as won,
          COALESCE(SUM(CASE WHEN o.converted_to_project_id IS NOT NULL THEN o.estimated_value ELSE 0 END), 0) as won_value,
          COALESCE(SUM(o.estimated_value * CASE COALESCE(o.probability, ps.probability)
            WHEN 'High' THEN 0.80
            WHEN 'Medium' THEN 0.40
            WHEN 'Low' THEN 0.15
            ELSE 0
          END), 0) as weighted_value
        FROM opportunities o
        LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
        WHERE o.tenant_id = $1 AND o.assigned_to = ANY($2)${oppFilter}
      `, [tenantId, employeeIds]);
    }

    // Get customers by account_manager
    let customersResult = { rows: [{ total: 0, active: 0 }] };
    if (memberNames.length > 0) {
      const custFilter = activeOnly ? ' AND active_customer = true' : '';
      customersResult = await db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN active_customer = true THEN 1 END) as active
        FROM customers
        WHERE tenant_id = $1 AND account_manager = ANY($2)${custFilter}
      `, [tenantId, memberNames]);
    }

    // Get estimates metrics (estimator_id references employees)
    let estimatesResult = { rows: [{ total: 0, total_value: 0, pending: 0, won: 0 }] };
    if (employeeIds.length > 0 || memberNames.length > 0) {
      const estFilter = activeOnly ? " AND status IN ('draft', 'pending', 'in_progress')" : '';
      estimatesResult = await db.query(`
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(total_cost), 0) as total_value,
          COUNT(CASE WHEN status IN ('draft', 'pending') THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'won' THEN 1 END) as won
        FROM estimates
        WHERE tenant_id = $1
          AND (
            estimator_id = ANY($2)
            OR estimator_name = ANY($3)
          )${estFilter}
      `, [tenantId, employeeIds.length > 0 ? employeeIds : [0], memberNames.length > 0 ? memberNames : ['']]);
    }

    // Get projects metrics (manager_id references employees)
    let projectsResult = { rows: [{ total: 0, active: 0, total_value: 0, total_backlog: 0, total_gross_margin: 0 }] };
    if (employeeIds.length > 0) {
      projectsResult = await db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN p.status = 'Open' THEN 1 END) as active,
          COALESCE(SUM(COALESCE(vc.contract_amount, p.contract_value)), 0) as total_value,
          COALESCE(SUM(CASE WHEN vc.id IS NOT NULL THEN COALESCE(vc.backlog, 0) + COALESCE(vc.ipd_amount, 0) ELSE p.backlog END), 0) as total_backlog,
          COALESCE(SUM(COALESCE(vc.gross_profit_dollars, 0)), 0) as total_gross_margin
        FROM projects p
        LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
        WHERE p.tenant_id = $1 AND p.manager_id = ANY($2) AND p.status = ANY($3)
      `, [tenantId, employeeIds, statuses]);
    }

    // Get cash flow metrics for team projects
    let cashFlowResult = { rows: [{ net_cash_position: 0, positive_count: 0, total_count: 0, total_open_receivables: 0 }] };
    if (employeeIds.length > 0) {
      cashFlowResult = await db.query(`
        SELECT
          COALESCE(SUM(vc.cash_flow), 0) as net_cash_position,
          COUNT(CASE WHEN vc.cash_flow > 0 THEN 1 END) as positive_count,
          COUNT(CASE WHEN vc.cash_flow IS NOT NULL THEN 1 END) as total_count,
          COALESCE(SUM(vc.open_receivables), 0) as total_open_receivables
        FROM projects p
        LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
        WHERE p.tenant_id = $1 AND p.manager_id = ANY($2) AND p.status = ANY($3)
      `, [tenantId, employeeIds, statuses]);
    }

    // Get buyout metrics for team projects (cost types 3=Subcontracts, 5=MEP Equipment, >= 10% complete)
    let buyoutResult = { rows: [{ total_buyout_remaining: 0, total_committed: 0, total_est_cost: 0, project_count: 0 }] };
    if (employeeIds.length > 0) {
      buyoutResult = await db.query(`
        SELECT
          COALESCE(SUM(agg.projected_cost - agg.committed_cost - agg.jtd_cost), 0) as total_buyout_remaining,
          COALESCE(SUM(agg.committed_cost), 0) as total_committed,
          COALESCE(SUM(agg.est_cost), 0) as total_est_cost,
          COUNT(*) as project_count
        FROM (
          SELECT
            p.id,
            COALESCE(SUM(pc.est_cost), 0) as est_cost,
            COALESCE(SUM(pc.jtd_cost), 0) as jtd_cost,
            COALESCE(SUM(pc.committed_cost), 0) as committed_cost,
            COALESCE(SUM(pc.projected_cost), 0) as projected_cost
          FROM projects p
          JOIN vp_phase_codes pc ON pc.linked_project_id = p.id AND pc.cost_type = ANY(ARRAY[3, 5])
          WHERE p.tenant_id = $1 AND p.manager_id = ANY($2) AND p.status = ANY($3)
            AND EXISTS (
              SELECT 1 FROM vp_contracts vc
              WHERE vc.linked_project_id = p.id
                AND vc.projected_cost > 0
                AND (vc.actual_cost / vc.projected_cost) >= 0.10
            )
          GROUP BY p.id
          HAVING COALESCE(SUM(pc.est_cost), 0) != 0
              OR COALESCE(SUM(pc.jtd_cost), 0) != 0
              OR COALESCE(SUM(pc.committed_cost), 0) != 0
              OR COALESCE(SUM(pc.projected_cost), 0) != 0
        ) agg
      `, [tenantId, employeeIds, statuses]);
    }

    return {
      opportunities: opportunitiesResult.rows[0],
      customers: customersResult.rows[0],
      estimates: estimatesResult.rows[0],
      projects: projectsResult.rows[0],
      cashFlow: cashFlowResult.rows[0],
      buyout: buyoutResult.rows[0]
    };
  }

  /**
   * Get team's opportunities
   * @param {string} filter - 'active' (default) or 'all'
   */
  static async getOpportunities(teamId, tenantId, filter = 'active', limit = 200) {
    const employeeIds = await this.getMemberEmployeeIds(teamId, tenantId);
    if (employeeIds.length === 0) return [];

    const activeFilter = filter === 'active'
      ? ` AND ps.name NOT IN ('Lost', 'Passed')
          AND NOT (ps.name = 'Awarded' AND o.awarded_status IS NOT NULL AND o.awarded_status IN ('In Progress', 'Completed'))`
      : '';
    const result = await db.query(`
      SELECT o.*,
             ps.name as stage_name, ps.color as stage_color,
             e.first_name || ' ' || e.last_name as assigned_to_name,
             COALESCE(c.name, c.customer_owner) as customer_name,
             cl.name as facility_location_name
      FROM opportunities o
      LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
      LEFT JOIN employees e ON o.assigned_to = e.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN customer_locations cl ON o.facility_location_id = cl.id
      WHERE o.tenant_id = $1 AND o.assigned_to = ANY($2)${activeFilter}
      ORDER BY o.last_activity_at DESC NULLS LAST, o.created_at DESC
      LIMIT $3
    `, [tenantId, employeeIds, limit]);
    return result.rows;
  }

  /**
   * Get team's customers
   * @param {string} filter - 'active' (default) or 'all'
   */
  static async getCustomers(teamId, tenantId, filter = 'active', limit = 200) {
    const memberNames = await this.getMemberNames(teamId, tenantId);
    if (memberNames.length === 0) return [];

    const activeFilter = filter === 'active' ? ' AND active_customer = true' : '';
    const result = await db.query(`
      SELECT * FROM customers
      WHERE tenant_id = $1 AND account_manager = ANY($2)${activeFilter}
      ORDER BY customer_facility ASC
      LIMIT $3
    `, [tenantId, memberNames, limit]);
    return result.rows;
  }

  /**
   * Get team's estimates
   * Matches by both estimator_id (employee ID) AND estimator_name (text field)
   * @param {string} filter - 'active' (default) or 'all'
   */
  static async getEstimates(teamId, tenantId, filter = 'active', limit = 200) {
    const employeeIds = await this.getMemberEmployeeIds(teamId, tenantId);
    const memberNames = await this.getMemberNames(teamId, tenantId);

    if (employeeIds.length === 0 && memberNames.length === 0) return [];

    const activeFilter = filter === 'active' ? " AND e.status IN ('draft', 'pending', 'in_progress')" : '';
    const result = await db.query(`
      SELECT DISTINCT e.*,
             COALESCE(e.estimator_name, emp.first_name || ' ' || emp.last_name) as estimator_full_name
      FROM estimates e
      LEFT JOIN employees emp ON e.estimator_id = emp.id
      WHERE e.tenant_id = $1
        AND (
          e.estimator_id = ANY($2)
          OR e.estimator_name = ANY($3)
        )${activeFilter}
      ORDER BY e.created_at DESC
      LIMIT $4
    `, [tenantId, employeeIds.length > 0 ? employeeIds : [0], memberNames.length > 0 ? memberNames : [''], limit]);
    return result.rows;
  }

  /**
   * Get team's projects (manager_id references employees)
   * @param {string} filter - 'active' (default) or 'all'
   */
  static async getProjects(teamId, tenantId, filter = 'active', limit = 500) {
    const employeeIds = await this.getMemberEmployeeIds(teamId, tenantId);
    if (employeeIds.length === 0) return [];

    const activeFilter = filter === 'active' ? " AND p.status = 'Open'" : '';
    const result = await db.query(`
      SELECT p.*,
             e.first_name || ' ' || e.last_name as manager_name,
             d.name as department_name,
             d.department_number,
             COALESCE(c.name, c.customer_owner, p.client) as customer_name,
             COALESCE(oc.name, oc.customer_owner) as owner_name,
             COALESCE(vc.contract_amount, p.contract_value) as contract_value,
             COALESCE(vc.gross_profit_percent, p.gross_margin_percent) as gross_margin_percent,
             CASE WHEN vc.id IS NOT NULL THEN COALESCE(vc.backlog, 0) + COALESCE(vc.ipd_amount, 0) ELSE p.backlog END as backlog,
             vc.actual_cost,
             CASE WHEN vc.projected_cost > 0 THEN (vc.actual_cost / vc.projected_cost) ELSE NULL END as percent_complete
      FROM projects p
      LEFT JOIN employees e ON p.manager_id = e.id
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN customers oc ON p.owner_customer_id = oc.id
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      WHERE p.tenant_id = $1 AND p.manager_id = ANY($2)${activeFilter}
      ORDER BY p.created_at DESC
      LIMIT $3
    `, [tenantId, employeeIds, limit]);
    return result.rows;
  }

  // ── Metric Configs ──────────────────────────────────────────────────────────

  static async getMetricConfigs(teamId, tenantId) {
    const result = await db.query(`
      SELECT tmc.*,
             u.first_name || ' ' || u.last_name as member_name,
             t.name as member_team_name
      FROM team_metric_configs tmc
      LEFT JOIN users u ON tmc.member_user_id = u.id
      LEFT JOIN teams t ON tmc.member_team_id = t.id
      WHERE tmc.team_id = $1 AND tmc.tenant_id = $2
      ORDER BY tmc.display_order ASC, tmc.id ASC
    `, [teamId, tenantId]);
    return result.rows;
  }

  static async addMetricConfig(teamId, tenantId, data) {
    const { member_user_id, member_team_id, metric_key, label, display_order } = data;
    const uid = member_user_id || null;
    const tid = member_team_id || null;

    // Manual upsert using IS NOT DISTINCT FROM to handle NULLs correctly
    const existing = await db.query(`
      SELECT id FROM team_metric_configs
      WHERE team_id = $1 AND tenant_id = $2 AND metric_key = $3
        AND (member_user_id IS NOT DISTINCT FROM $4)
        AND (member_team_id IS NOT DISTINCT FROM $5)
    `, [teamId, tenantId, metric_key, uid, tid]);

    if (existing.rows.length > 0) {
      const r = await db.query(`
        UPDATE team_metric_configs
        SET label = $1, display_order = $2
        WHERE id = $3
        RETURNING *
      `, [label, display_order || 0, existing.rows[0].id]);
      return r.rows[0];
    }

    const r = await db.query(`
      INSERT INTO team_metric_configs
        (team_id, tenant_id, member_user_id, member_team_id, metric_key, label, display_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [teamId, tenantId, uid, tid, metric_key, label, display_order || 0]);
    return r.rows[0];
  }

  static async deleteMetricConfig(teamId, tenantId, configId) {
    await db.query(`
      DELETE FROM team_metric_configs
      WHERE id = $1 AND team_id = $2 AND tenant_id = $3
    `, [configId, teamId, tenantId]);
  }

  static async reorderMetricConfigs(teamId, tenantId, orderedIds) {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.query(`
        UPDATE team_metric_configs SET display_order = $1
        WHERE id = $2 AND team_id = $3 AND tenant_id = $4
      `, [i, orderedIds[i], teamId, tenantId]);
    }
  }

  static async updateMetricConfig(teamId, tenantId, configId, data) {
    const result = await db.query(`
      UPDATE team_metric_configs
      SET goal = $1
      WHERE id = $2 AND team_id = $3 AND tenant_id = $4
      RETURNING *
    `, [data.goal ?? null, configId, teamId, tenantId]);
    return result.rows[0];
  }

  // ── Snapshot Settings ────────────────────────────────────────────────────────

  static async getSnapshotSettings(teamId, tenantId) {
    const r = await db.query(`
      SELECT * FROM team_metric_settings WHERE team_id = $1 AND tenant_id = $2
    `, [teamId, tenantId]);
    return r.rows[0] || { team_id: teamId, snapshot_day_of_week: 1, snapshot_hour: 18 };
  }

  static async upsertSnapshotSettings(teamId, tenantId, { snapshot_day_of_week, snapshot_hour }) {
    const r = await db.query(`
      INSERT INTO team_metric_settings (team_id, tenant_id, snapshot_day_of_week, snapshot_hour, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (team_id) DO UPDATE
        SET snapshot_day_of_week = EXCLUDED.snapshot_day_of_week,
            snapshot_hour = EXCLUDED.snapshot_hour,
            updated_at = NOW()
      RETURNING *
    `, [teamId, tenantId, snapshot_day_of_week, snapshot_hour]);
    return r.rows[0];
  }

  // ── Metric Snapshots ─────────────────────────────────────────────────────────

  static async getMetricSnapshots(teamId, tenantId, weeks = 12) {
    const result = await db.query(`
      SELECT member_user_id, member_team_id, metric_key, week_start, value
      FROM team_metric_snapshots
      WHERE team_id = $1 AND tenant_id = $2
        AND week_start >= (
          DATE_TRUNC('week', NOW()) - ((${weeks} - 1) * INTERVAL '1 week')
        )::DATE
      ORDER BY week_start ASC
    `, [teamId, tenantId]);
    return result.rows;
  }

  static async captureMetricSnapshot(teamId, tenantId) {
    const configs = await this.getMetricConfigs(teamId, tenantId);
    if (configs.length === 0) return [];

    const weekStart = await db.query(`SELECT DATE_TRUNC('week', NOW())::DATE as ws`);
    const ws = weekStart.rows[0].ws;

    // Gather unique scopes to avoid redundant DB queries
    const scopeMap = new Map();
    for (const c of configs) {
      const key = `${c.member_user_id ?? 'null'}_${c.member_team_id ?? 'null'}`;
      if (!scopeMap.has(key)) {
        scopeMap.set(key, { member_user_id: c.member_user_id, member_team_id: c.member_team_id });
      }
    }

    const metricsByScope = {};
    for (const [key, scope] of scopeMap) {
      metricsByScope[key] = await this._computeCurrentMetrics(teamId, tenantId, scope.member_user_id, scope.member_team_id);
    }

    const saved = [];
    for (const config of configs) {
      const scopeKey = `${config.member_user_id ?? 'null'}_${config.member_team_id ?? 'null'}`;
      const metrics = metricsByScope[scopeKey];
      const value = this._extractMetricValue(metrics, config.metric_key);
      if (value === null) continue;

      // Manual upsert using IS NOT DISTINCT FROM
      const existing = await db.query(`
        SELECT id FROM team_metric_snapshots
        WHERE team_id = $1 AND metric_key = $2 AND week_start = $3
          AND (member_user_id IS NOT DISTINCT FROM $4)
          AND (member_team_id IS NOT DISTINCT FROM $5)
      `, [teamId, config.metric_key, ws, config.member_user_id, config.member_team_id]);

      let r;
      if (existing.rows.length > 0) {
        r = await db.query(`
          UPDATE team_metric_snapshots SET value = $1, updated_at = NOW()
          WHERE id = $2 RETURNING *
        `, [value, existing.rows[0].id]);
      } else {
        r = await db.query(`
          INSERT INTO team_metric_snapshots
            (team_id, tenant_id, member_user_id, member_team_id, metric_key, week_start, value)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [teamId, tenantId, config.member_user_id, config.member_team_id, config.metric_key, ws, value]);
      }
      saved.push(r.rows[0]);
    }
    return saved;
  }

  static _extractMetricValue(metrics, key) {
    if (!metrics) return null;
    const map = {
      opportunities:      () => Number(metrics.opportunities?.total ?? 0),
      opp_value:          () => Number(metrics.opportunities?.total_value ?? 0),
      opp_weighted_value: () => Number(metrics.opportunities?.weighted_value ?? 0),
      projects:           () => Number(metrics.projects?.active ?? 0),
      contract_value:     () => Number(metrics.projects?.total_value ?? 0),
      backlog:            () => Number(metrics.projects?.total_backlog ?? 0),
      cash_flow:          () => Number(metrics.cashFlow?.net_cash_position ?? 0),
      buyout_remaining:   () => Number(metrics.buyout?.total_buyout_remaining ?? 0),
    };
    return map[key] ? map[key]() : null;
  }

  // Compute live metrics for a scope: sub-team, individual, or whole parent team
  static async _computeCurrentMetrics(teamId, tenantId, memberId, memberTeamId) {
    const statuses = ['Open'];

    if (memberTeamId) {
      // Sub-team aggregate: delegate to the sub-team's getDashboardMetrics
      return this.getDashboardMetrics(memberTeamId, tenantId, statuses);
    }

    if (!memberId) {
      // Whole parent team
      return this.getDashboardMetrics(teamId, tenantId, statuses);
    }

    // Individual member: look up their employee_id via user_id
    const memberInfo = await db.query(`
      SELECT tm.employee_id,
             e.first_name || ' ' || e.last_name as full_name
      FROM team_members tm
      JOIN employees e ON tm.employee_id = e.id
      WHERE tm.team_id = $1 AND e.user_id = $2
      LIMIT 1
    `, [teamId, memberId]);

    if (memberInfo.rows.length === 0) return null;
    const { employee_id } = memberInfo.rows[0];
    const employeeIds = [employee_id];

    const [opps, projects, cashFlow, buyout] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(o.estimated_value), 0) as total_value,
          COALESCE(SUM(o.estimated_value * CASE COALESCE(o.probability, ps.probability)
            WHEN 'High' THEN 0.80 WHEN 'Medium' THEN 0.40 WHEN 'Low' THEN 0.15 ELSE 0 END), 0) as weighted_value
        FROM opportunities o
        LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
        WHERE o.tenant_id = $1 AND o.assigned_to = ANY($2)
          AND ps.name NOT IN ('Lost', 'Passed')
          AND NOT (ps.name = 'Awarded' AND o.awarded_status IN ('In Progress', 'Completed'))
      `, [tenantId, employeeIds]),

      db.query(`
        SELECT
          COUNT(CASE WHEN p.status = 'Open' THEN 1 END) as active,
          COALESCE(SUM(COALESCE(vc.contract_amount, p.contract_value)), 0) as total_value,
          COALESCE(SUM(CASE WHEN vc.id IS NOT NULL THEN COALESCE(vc.backlog, 0) + COALESCE(vc.ipd_amount, 0) ELSE p.backlog END), 0) as total_backlog
        FROM projects p
        LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
        WHERE p.tenant_id = $1 AND p.manager_id = ANY($2) AND p.status = 'Open'
      `, [tenantId, employeeIds]),

      db.query(`
        SELECT COALESCE(SUM(vc.cash_flow), 0) as net_cash_position
        FROM projects p
        LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
        WHERE p.tenant_id = $1 AND p.manager_id = ANY($2) AND p.status = 'Open'
      `, [tenantId, employeeIds]),

      db.query(`
        SELECT COALESCE(SUM(agg.projected_cost - agg.committed_cost - agg.jtd_cost), 0) as total_buyout_remaining
        FROM (
          SELECT p.id,
            COALESCE(SUM(pc.jtd_cost), 0) as jtd_cost,
            COALESCE(SUM(pc.committed_cost), 0) as committed_cost,
            COALESCE(SUM(pc.projected_cost), 0) as projected_cost
          FROM projects p
          JOIN vp_phase_codes pc ON pc.linked_project_id = p.id AND pc.cost_type = ANY(ARRAY[3, 5])
          WHERE p.tenant_id = $1 AND p.manager_id = ANY($2) AND p.status = 'Open'
            AND EXISTS (
              SELECT 1 FROM vp_contracts vc
              WHERE vc.linked_project_id = p.id AND vc.projected_cost > 0
                AND (vc.actual_cost / vc.projected_cost) >= 0.10
            )
          GROUP BY p.id
        ) agg
      `, [tenantId, employeeIds])
    ]);

    return {
      opportunities: opps.rows[0],
      projects:      projects.rows[0],
      cashFlow:      cashFlow.rows[0],
      buyout:        buyout.rows[0],
    };
  }
}

module.exports = Team;
