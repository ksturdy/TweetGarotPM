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
      WHERE tm.team_id = $1 AND t.tenant_id = $2
      ORDER BY tm.role = 'lead' DESC, e.last_name ASC
    `, [teamId, tenantId]);
    return result.rows;
  }

  /**
   * Add member to team
   */
  static async addMember(teamId, employeeId, role = 'member') {
    const result = await db.query(`
      INSERT INTO team_members (team_id, employee_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (team_id, employee_id) DO UPDATE SET role = $3
      RETURNING *
    `, [teamId, employeeId, role]);
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
   */
  static async updateMemberRole(teamId, employeeId, role) {
    const result = await db.query(`
      UPDATE team_members SET role = $1
      WHERE team_id = $2 AND employee_id = $3
      RETURNING *
    `, [role, teamId, employeeId]);
    return result.rows[0];
  }

  /**
   * Get all employee IDs from teams where the given user is a member or lead
   * Used for "My Team" filtering on the dashboard
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

    // Find all teams where the user is a member or team lead
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

        UNION

        -- All members of teams where user is the team lead
        SELECT tm.employee_id
        FROM teams t
        JOIN team_members tm ON tm.team_id = t.id
        WHERE t.team_lead_id = $1 AND t.tenant_id = $2 AND t.is_active = true

        UNION

        -- The team lead themselves (for teams they lead)
        SELECT t.team_lead_id as employee_id
        FROM teams t
        WHERE t.team_lead_id = $1 AND t.tenant_id = $2 AND t.is_active = true
      ) combined
      WHERE employee_id IS NOT NULL
    `, [employeeId, tenantId]);

    return result.rows.map(r => r.employee_id);
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
   * Get team dashboard metrics
   */
  static async getDashboardMetrics(teamId, tenantId) {
    const userIds = await this.getMemberUserIds(teamId, tenantId);
    const memberNames = await this.getMemberNames(teamId, tenantId);

    // Default metrics if no members
    if (userIds.length === 0) {
      return {
        opportunities: { total: 0, total_value: 0, won: 0, won_value: 0 },
        customers: { total: 0, active: 0 },
        estimates: { total: 0, total_value: 0, pending: 0, won: 0 }
      };
    }

    // Get opportunities metrics
    const opportunitiesResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(estimated_value), 0) as total_value,
        COUNT(CASE WHEN converted_to_project_id IS NOT NULL THEN 1 END) as won,
        COALESCE(SUM(CASE WHEN converted_to_project_id IS NOT NULL THEN estimated_value ELSE 0 END), 0) as won_value
      FROM opportunities
      WHERE tenant_id = $1 AND assigned_to = ANY($2)
    `, [tenantId, userIds]);

    // Get customers by account_manager
    let customersResult = { rows: [{ total: 0, active: 0 }] };
    if (memberNames.length > 0) {
      customersResult = await db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN active_customer = true THEN 1 END) as active
        FROM customers
        WHERE tenant_id = $1 AND account_manager = ANY($2)
      `, [tenantId, memberNames]);
    }

    // Get estimates metrics (match by both estimator_id and estimator_name)
    const estimatesResult = await db.query(`
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
        )
    `, [tenantId, userIds.length > 0 ? userIds : [0], memberNames]);

    return {
      opportunities: opportunitiesResult.rows[0],
      customers: customersResult.rows[0],
      estimates: estimatesResult.rows[0]
    };
  }

  /**
   * Get team's opportunities
   */
  static async getOpportunities(teamId, tenantId, limit = 50) {
    const userIds = await this.getMemberUserIds(teamId, tenantId);
    if (userIds.length === 0) return [];

    const result = await db.query(`
      SELECT o.*,
             ps.name as stage_name, ps.color as stage_color,
             u.first_name || ' ' || u.last_name as assigned_to_name,
             c.customer_owner as customer_name,
             fc.customer_facility as facility_customer_name
      FROM opportunities o
      LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
      LEFT JOIN users u ON o.assigned_to = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN customers fc ON o.facility_customer_id = fc.id
      WHERE o.tenant_id = $1 AND o.assigned_to = ANY($2)
      ORDER BY o.last_activity_at DESC NULLS LAST, o.created_at DESC
      LIMIT $3
    `, [tenantId, userIds, limit]);
    return result.rows;
  }

  /**
   * Get team's customers
   */
  static async getCustomers(teamId, tenantId, limit = 50) {
    const memberNames = await this.getMemberNames(teamId, tenantId);
    if (memberNames.length === 0) return [];

    const result = await db.query(`
      SELECT * FROM customers
      WHERE tenant_id = $1 AND account_manager = ANY($2)
      ORDER BY customer_facility ASC
      LIMIT $3
    `, [tenantId, memberNames, limit]);
    return result.rows;
  }

  /**
   * Get team's estimates
   * Matches by both estimator_id (user ID) AND estimator_name (text field)
   */
  static async getEstimates(teamId, tenantId, limit = 50) {
    const userIds = await this.getMemberUserIds(teamId, tenantId);
    const memberNames = await this.getMemberNames(teamId, tenantId);

    if (userIds.length === 0 && memberNames.length === 0) return [];

    const result = await db.query(`
      SELECT DISTINCT e.*,
             COALESCE(e.estimator_name, u.first_name || ' ' || u.last_name) as estimator_full_name
      FROM estimates e
      LEFT JOIN users u ON e.estimator_id = u.id
      WHERE e.tenant_id = $1
        AND (
          e.estimator_id = ANY($2)
          OR e.estimator_name = ANY($3)
        )
      ORDER BY e.created_at DESC
      LIMIT $4
    `, [tenantId, userIds.length > 0 ? userIds : [0], memberNames, limit]);
    return result.rows;
  }
}

module.exports = Team;
