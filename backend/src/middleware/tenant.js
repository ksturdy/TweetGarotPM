/**
 * Tenant Middleware
 * Provides multi-tenant isolation and context for all requests
 */

const db = require('../config/database');

/**
 * Injects tenant context from authenticated user
 * Must be used AFTER authenticate middleware
 */
const tenantContext = async (req, res, next) => {
  try {
    // User must be authenticated first
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get tenant_id from JWT token
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      console.error('[Tenant] No tenant_id in token for user:', req.user.id);
      return res.status(403).json({ error: 'No tenant context available' });
    }

    // Attach tenant ID to request for easy access
    req.tenantId = tenantId;

    // Optionally load full tenant info (cached in production)
    if (req.query.includeTenant === 'true' || req.headers['x-include-tenant'] === 'true') {
      const tenant = await getTenantById(tenantId);
      if (!tenant) {
        return res.status(403).json({ error: 'Tenant not found' });
      }
      if (!tenant.is_active) {
        return res.status(403).json({ error: 'Tenant account is inactive' });
      }
      req.tenant = tenant;
    }

    next();
  } catch (error) {
    console.error('[Tenant] Middleware error:', error);
    next(error);
  }
};

/**
 * Loads full tenant information into request
 * Use when you need tenant settings, limits, or features
 */
const loadTenant = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return res.status(403).json({ error: 'No tenant context' });
    }

    const tenant = await getTenantById(req.tenantId);
    if (!tenant) {
      return res.status(403).json({ error: 'Tenant not found' });
    }
    if (!tenant.is_active) {
      return res.status(403).json({ error: 'Tenant account is inactive' });
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('[Tenant] Load tenant error:', error);
    next(error);
  }
};

/**
 * Checks if a specific feature is enabled for the tenant
 * @param {string} featureName - Feature name from subscription_plans.features
 */
const requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      if (!req.tenantId) {
        return res.status(403).json({ error: 'No tenant context' });
      }

      // Load tenant with plan if not already loaded
      if (!req.tenant) {
        req.tenant = await getTenantWithPlan(req.tenantId);
      }

      if (!req.tenant) {
        return res.status(403).json({ error: 'Tenant not found' });
      }

      const features = req.tenant.plan_features || {};

      if (!features[featureName]) {
        return res.status(403).json({
          error: 'Feature not available',
          message: `The ${featureName} feature is not available on your current plan`,
          feature: featureName,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      console.error('[Tenant] Feature check error:', error);
      next(error);
    }
  };
};

/**
 * Checks if tenant is within usage limits
 * @param {string} limitName - Limit name from subscription_plans.limits (e.g., 'max_users')
 * @param {function} countFn - Async function that returns current count
 */
const checkLimit = (limitName, countFn) => {
  return async (req, res, next) => {
    try {
      if (!req.tenantId) {
        return res.status(403).json({ error: 'No tenant context' });
      }

      // Load tenant with plan if not already loaded
      if (!req.tenant) {
        req.tenant = await getTenantWithPlan(req.tenantId);
      }

      if (!req.tenant) {
        return res.status(403).json({ error: 'Tenant not found' });
      }

      const limits = req.tenant.plan_limits || {};
      const maxLimit = limits[limitName];

      // If no limit defined, allow unlimited
      if (maxLimit === undefined || maxLimit === null || maxLimit === -1) {
        return next();
      }

      // Get current count
      const currentCount = await countFn(req.tenantId);

      if (currentCount >= maxLimit) {
        return res.status(403).json({
          error: 'Limit exceeded',
          message: `You have reached the maximum of ${maxLimit} ${limitName.replace('max_', '').replace('_', ' ')} on your current plan`,
          limit: limitName,
          current: currentCount,
          max: maxLimit,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      console.error('[Tenant] Limit check error:', error);
      next(error);
    }
  };
};

// =====================================================
// Helper Functions
// =====================================================

/**
 * Get tenant by ID
 */
async function getTenantById(tenantId) {
  const result = await db.query(
    `SELECT t.*, sp.name as plan_name, sp.display_name as plan_display_name,
            sp.limits as plan_limits, sp.features as plan_features
     FROM tenants t
     LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
     WHERE t.id = $1`,
    [tenantId]
  );
  return result.rows[0];
}

/**
 * Get tenant with plan details
 */
async function getTenantWithPlan(tenantId) {
  return getTenantById(tenantId);
}

/**
 * Get tenant by slug (for subdomain routing)
 */
async function getTenantBySlug(slug) {
  const result = await db.query(
    `SELECT t.*, sp.name as plan_name, sp.display_name as plan_display_name,
            sp.limits as plan_limits, sp.features as plan_features
     FROM tenants t
     LEFT JOIN subscription_plans sp ON t.plan_id = sp.id
     WHERE t.slug = $1`,
    [slug]
  );
  return result.rows[0];
}

/**
 * Check if slug is available
 */
async function isSlugAvailable(slug) {
  const result = await db.query(
    'SELECT id FROM tenants WHERE slug = $1',
    [slug]
  );
  return result.rows.length === 0;
}

/**
 * Create a new tenant
 */
async function createTenant({ name, slug, email, phone, planId = 1, settings = {} }) {
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
    `INSERT INTO tenants (name, slug, email, phone, plan_id, settings)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, slug, email, phone, planId, JSON.stringify(mergedSettings)]
  );

  return result.rows[0];
}

/**
 * Create default data for a new tenant (departments, office locations, pipeline stages)
 */
async function createTenantDefaults(tenantId) {
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
}

module.exports = {
  tenantContext,
  loadTenant,
  requireFeature,
  checkLimit,
  getTenantById,
  getTenantBySlug,
  isSlugAvailable,
  createTenant,
  createTenantDefaults,
};
