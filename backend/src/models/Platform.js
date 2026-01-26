/**
 * Platform Model
 * Handles platform-level operations for super admins
 * Used to manage tenants, plans, and platform-wide statistics
 */

const db = require('../config/database');

const Platform = {
  /**
   * Get all tenants with detailed info
   */
  async getAllTenants({ status, search, sortBy = 'created_at', order = 'desc', limit = 50, offset = 0 } = {}) {
    let query = `
      SELECT
        t.*,
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        sp.price_monthly,
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND is_active = TRUE) as active_users,
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as total_users,
        (SELECT COUNT(*) FROM projects WHERE tenant_id = t.id) as project_count,
        (SELECT COUNT(*) FROM customers WHERE tenant_id = t.id) as customer_count,
        (SELECT COUNT(*) FROM opportunities WHERE tenant_id = t.id) as opportunity_count
      FROM tenants t
      LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND t.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (search) {
      query += ` AND (t.name ILIKE $${paramCount} OR t.slug ILIKE $${paramCount} OR t.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Validate sort column
    const validSortColumns = ['created_at', 'name', 'status', 'plan_name'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY t.${sortColumn} ${sortOrder}`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Get tenant count
   */
  async getTenantCount({ status, search } = {}) {
    let query = 'SELECT COUNT(*) as count FROM tenants t WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND t.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (search) {
      query += ` AND (t.name ILIKE $${paramCount} OR t.slug ILIKE $${paramCount} OR t.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    const result = await db.query(query, params);
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Get detailed tenant info for platform admin
   */
  async getTenantDetails(tenantId) {
    const result = await db.query(
      `SELECT
        t.*,
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        sp.limits as plan_limits,
        sp.features as plan_features,
        sp.price_monthly,
        sp.price_yearly,
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id AND is_active = TRUE) as active_users,
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as total_users,
        (SELECT COUNT(*) FROM projects WHERE tenant_id = t.id) as project_count,
        (SELECT COUNT(*) FROM customers WHERE tenant_id = t.id) as customer_count,
        (SELECT COUNT(*) FROM opportunities WHERE tenant_id = t.id) as opportunity_count,
        (SELECT COUNT(*) FROM companies WHERE tenant_id = t.id) as company_count,
        (SELECT COUNT(*) FROM employees WHERE tenant_id = t.id) as employee_count,
        (SELECT email FROM users WHERE tenant_id = t.id AND role = 'admin' ORDER BY created_at LIMIT 1) as primary_admin_email
      FROM tenants t
      LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
      WHERE t.id = $1`,
      [tenantId]
    );
    return result.rows[0];
  },

  /**
   * Suspend a tenant
   */
  async suspendTenant(tenantId, reason, adminUserId) {
    const result = await db.query(
      `UPDATE tenants
       SET status = 'suspended',
           suspended_at = CURRENT_TIMESTAMP,
           suspended_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [tenantId, reason]
    );

    // Log the action
    await this.logAudit(adminUserId, 'tenant_suspended', 'tenant', tenantId, { reason });

    return result.rows[0];
  },

  /**
   * Activate/unsuspend a tenant
   */
  async activateTenant(tenantId, adminUserId) {
    const result = await db.query(
      `UPDATE tenants
       SET status = 'active',
           suspended_at = NULL,
           suspended_reason = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [tenantId]
    );

    // Log the action
    await this.logAudit(adminUserId, 'tenant_activated', 'tenant', tenantId);

    return result.rows[0];
  },

  /**
   * Change tenant plan
   */
  async changeTenantPlan(tenantId, planId, adminUserId) {
    // Get current plan for logging
    const currentTenant = await db.query('SELECT plan_id FROM tenants WHERE id = $1', [tenantId]);
    const oldPlanId = currentTenant.rows[0]?.plan_id;

    const result = await db.query(
      `UPDATE tenants
       SET plan_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [tenantId, planId]
    );

    // Log the action
    await this.logAudit(adminUserId, 'tenant_plan_changed', 'tenant', tenantId, {
      old_plan_id: oldPlanId,
      new_plan_id: planId,
    });

    return result.rows[0];
  },

  /**
   * Delete a tenant (hard delete - use with caution!)
   */
  async deleteTenant(tenantId, adminUserId) {
    // Get tenant info for logging before deletion
    const tenant = await db.query('SELECT name, slug FROM tenants WHERE id = $1', [tenantId]);

    // Log the action first
    await this.logAudit(adminUserId, 'tenant_deleted', 'tenant', tenantId, {
      tenant_name: tenant.rows[0]?.name,
      tenant_slug: tenant.rows[0]?.slug,
    });

    // Delete tenant (cascades to all related data)
    await db.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  },

  /**
   * Get platform-wide statistics
   */
  async getStats() {
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM tenants) as total_tenants,
        (SELECT COUNT(*) FROM tenants WHERE status = 'active') as active_tenants,
        (SELECT COUNT(*) FROM tenants WHERE status = 'suspended') as suspended_tenants,
        (SELECT COUNT(*) FROM tenants WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_tenants_30d,
        (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as total_active_users,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM projects) as total_projects,
        (SELECT COUNT(*) FROM customers) as total_customers,
        (SELECT COUNT(*) FROM opportunities) as total_opportunities
    `);
    return result.rows[0];
  },

  /**
   * Get revenue/plan distribution stats
   */
  async getPlanStats() {
    const result = await db.query(`
      SELECT
        sp.name as plan_name,
        sp.display_name,
        sp.price_monthly,
        COUNT(t.id) as tenant_count,
        SUM(CASE WHEN t.billing_cycle = 'yearly' THEN sp.price_yearly ELSE sp.price_monthly END) as monthly_revenue
      FROM subscription_plans sp
      LEFT JOIN tenants t ON t.plan_id = sp.id AND t.status = 'active'
      GROUP BY sp.id, sp.name, sp.display_name, sp.price_monthly
      ORDER BY sp.price_monthly
    `);
    return result.rows;
  },

  /**
   * Get all subscription plans
   */
  async getPlans() {
    const result = await db.query(
      `SELECT * FROM subscription_plans ORDER BY price_monthly`
    );
    return result.rows;
  },

  /**
   * Create a new subscription plan
   */
  async createPlan({ name, displayName, description, priceMonthly, priceYearly, limits, features }) {
    const result = await db.query(
      `INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, limits, features)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, displayName, description, priceMonthly, priceYearly, JSON.stringify(limits), JSON.stringify(features)]
    );
    return result.rows[0];
  },

  /**
   * Update a subscription plan
   */
  async updatePlan(planId, { displayName, description, priceMonthly, priceYearly, limits, features }) {
    const result = await db.query(
      `UPDATE subscription_plans
       SET display_name = COALESCE($2, display_name),
           description = COALESCE($3, description),
           price_monthly = COALESCE($4, price_monthly),
           price_yearly = COALESCE($5, price_yearly),
           limits = COALESCE($6, limits),
           features = COALESCE($7, features),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [planId, displayName, description, priceMonthly, priceYearly, limits ? JSON.stringify(limits) : null, features ? JSON.stringify(features) : null]
    );
    return result.rows[0];
  },

  /**
   * Get platform audit log
   */
  async getAuditLog({ limit = 50, offset = 0, action, adminUserId } = {}) {
    let query = `
      SELECT
        pal.*,
        u.email as admin_email,
        u.first_name || ' ' || u.last_name as admin_name
      FROM platform_audit_log pal
      JOIN users u ON pal.admin_user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (action) {
      query += ` AND pal.action = $${paramCount}`;
      params.push(action);
      paramCount++;
    }

    if (adminUserId) {
      query += ` AND pal.admin_user_id = $${paramCount}`;
      params.push(adminUserId);
      paramCount++;
    }

    query += ` ORDER BY pal.created_at DESC`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Log a platform admin action
   */
  async logAudit(adminUserId, action, targetType, targetId, details = null, ipAddress = null, userAgent = null) {
    await db.query(
      `INSERT INTO platform_audit_log (admin_user_id, action, target_type, target_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [adminUserId, action, targetType, targetId, details ? JSON.stringify(details) : null, ipAddress, userAgent]
    );
  },

  /**
   * Get users across all tenants (for platform admin)
   */
  async getAllUsers({ search, tenantId, isActive, limit = 50, offset = 0 } = {}) {
    let query = `
      SELECT
        u.id, u.email, u.first_name, u.last_name, u.role, u.is_active, u.created_at, u.last_login_at,
        t.name as tenant_name, t.slug as tenant_slug
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.is_platform_admin = FALSE
    `;
    const params = [];
    let paramCount = 1;

    if (search) {
      query += ` AND (u.email ILIKE $${paramCount} OR u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (tenantId) {
      query += ` AND u.tenant_id = $${paramCount}`;
      params.push(tenantId);
      paramCount++;
    }

    if (isActive !== undefined) {
      query += ` AND u.is_active = $${paramCount}`;
      params.push(isActive);
      paramCount++;
    }

    query += ` ORDER BY u.created_at DESC`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  },
};

module.exports = Platform;
