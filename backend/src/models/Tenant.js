/**
 * Tenant Model
 * Handles all tenant/organization data operations
 */

const db = require('../config/database');

const Tenant = {
  /**
   * Find tenant by ID
   */
  async findById(id) {
    const result = await db.query(
      `SELECT t.*, sp.name as plan_name, sp.display_name as plan_display_name,
              sp.limits as plan_limits, sp.features as plan_features
       FROM tenants t
       LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
       WHERE t.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  /**
   * Find tenant by slug
   */
  async findBySlug(slug) {
    const result = await db.query(
      `SELECT t.*, sp.name as plan_name, sp.display_name as plan_display_name,
              sp.limits as plan_limits, sp.features as plan_features
       FROM tenants t
       LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
       WHERE t.slug = $1`,
      [slug]
    );
    return result.rows[0];
  },

  /**
   * Check if slug is available
   */
  async isSlugAvailable(slug) {
    const result = await db.query(
      'SELECT id FROM tenants WHERE slug = $1',
      [slug]
    );
    return result.rows.length === 0;
  },

  /**
   * Create a new tenant
   */
  async create({ name, slug, email, phone, address, city, state, zipCode, website, planId = 1, settings = {} }) {
    const defaultSettings = {
      branding: {
        logo_url: null,
        primary_color: '#1976d2',
        company_name: name,
      },
      notifications: {
        email_enabled: true,
        daily_digest: false,
      },
      defaults: {
        timezone: 'America/Indiana/Indianapolis',
        date_format: 'MM/DD/YYYY',
      },
    };

    const mergedSettings = { ...defaultSettings, ...settings };

    const result = await db.query(
      `INSERT INTO tenants (name, slug, email, phone, address, city, state, zip_code, website, plan_id, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [name, slug, email, phone, address, city, state, zipCode, website, planId, JSON.stringify(mergedSettings)]
    );

    return result.rows[0];
  },

  /**
   * Update tenant
   */
  async update(id, { name, email, phone, address, city, state, zipCode, website, settings }) {
    const result = await db.query(
      `UPDATE tenants
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           address = COALESCE($4, address),
           city = COALESCE($5, city),
           state = COALESCE($6, state),
           zip_code = COALESCE($7, zip_code),
           website = COALESCE($8, website),
           settings = COALESCE($9, settings),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [name, email, phone, address, city, state, zipCode, website, settings ? JSON.stringify(settings) : null, id]
    );
    return result.rows[0];
  },

  /**
   * Update tenant settings (partial update)
   */
  async updateSettings(id, settingsUpdate) {
    const result = await db.query(
      `UPDATE tenants
       SET settings = settings || $1::jsonb,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(settingsUpdate), id]
    );
    return result.rows[0];
  },

  /**
   * Update tenant plan
   */
  async updatePlan(id, planId) {
    const result = await db.query(
      `UPDATE tenants
       SET plan_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [planId, id]
    );
    return result.rows[0];
  },

  /**
   * Deactivate tenant
   */
  async deactivate(id) {
    const result = await db.query(
      `UPDATE tenants
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  /**
   * Activate tenant
   */
  async activate(id) {
    const result = await db.query(
      `UPDATE tenants
       SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  },

  /**
   * Get all tenants (admin only)
   */
  async findAll() {
    const result = await db.query(
      `SELECT t.*, sp.name as plan_name, sp.display_name as plan_display_name,
              (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count,
              (SELECT COUNT(*) FROM projects WHERE tenant_id = t.id) as project_count
       FROM tenants t
       LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
       ORDER BY t.created_at DESC`
    );
    return result.rows;
  },

  /**
   * Get tenant usage stats
   */
  async getUsageStats(tenantId) {
    const result = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE tenant_id = $1) as user_count,
         (SELECT COUNT(*) FROM projects WHERE tenant_id = $1) as project_count,
         (SELECT COUNT(*) FROM customers WHERE tenant_id = $1) as customer_count,
         (SELECT COUNT(*) FROM opportunities WHERE tenant_id = $1) as opportunity_count,
         (SELECT COUNT(*) FROM employees WHERE tenant_id = $1) as employee_count`,
      [tenantId]
    );
    return result.rows[0];
  },

  /**
   * Create default data for a new tenant
   */
  async createDefaults(tenantId) {
    // Create default departments
    await db.query(
      `INSERT INTO departments (tenant_id, name, description)
       VALUES
         ($1, 'Executive', 'Executive leadership and management'),
         ($1, 'Operations', 'Field operations and project management'),
         ($1, 'Estimating', 'Project estimating and bidding'),
         ($1, 'Accounting', 'Finance and accounting'),
         ($1, 'Human Resources', 'HR and employee relations'),
         ($1, 'Safety', 'Safety and compliance'),
         ($1, 'Purchasing', 'Procurement and vendor management'),
         ($1, 'Service', 'Service and maintenance')
       ON CONFLICT DO NOTHING`,
      [tenantId]
    );

    // Create default office location
    await db.query(
      `INSERT INTO office_locations (tenant_id, name, address, city, state, zip_code)
       VALUES ($1, 'Main Office', '', '', '', '')
       ON CONFLICT DO NOTHING`,
      [tenantId]
    );

    // Create default pipeline stages
    await db.query(
      `INSERT INTO pipeline_stages (tenant_id, name, display_order, color, probability)
       VALUES
         ($1, 'New Lead', 1, '#6B7280', 10),
         ($1, 'Contacted', 2, '#3B82F6', 20),
         ($1, 'Qualified', 3, '#8B5CF6', 40),
         ($1, 'Proposal Sent', 4, '#F59E0B', 60),
         ($1, 'Negotiation', 5, '#EF4444', 75),
         ($1, 'Won', 6, '#10B981', 100),
         ($1, 'Lost', 7, '#374151', 0)
       ON CONFLICT DO NOTHING`,
      [tenantId]
    );
  },

  /**
   * Delete tenant and all associated data
   * WARNING: This is destructive and should be used carefully
   */
  async delete(id) {
    // Due to foreign key constraints, deleting tenant will cascade to all related data
    // Make sure this is really what you want!
    await db.query('DELETE FROM tenants WHERE id = $1', [id]);
  },
};

module.exports = Tenant;
