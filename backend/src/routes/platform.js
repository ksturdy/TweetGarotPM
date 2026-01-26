/**
 * Platform Admin Routes
 * Routes for platform-level administration (super admin)
 * All routes require platform admin authentication
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const Platform = require('../models/Platform');
const Tenant = require('../models/Tenant');
const { authenticate, authorizePlatformAdmin } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and platform admin access
router.use(authenticate);
router.use(authorizePlatformAdmin);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// =====================================================
// DASHBOARD & STATS
// =====================================================

/**
 * Get platform dashboard statistics
 * GET /api/platform/stats
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await Platform.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * Get plan distribution and revenue stats
 * GET /api/platform/stats/plans
 */
router.get('/stats/plans', async (req, res, next) => {
  try {
    const planStats = await Platform.getPlanStats();
    res.json(planStats);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// TENANT MANAGEMENT
// =====================================================

/**
 * Get all tenants
 * GET /api/platform/tenants
 */
router.get('/tenants', async (req, res, next) => {
  try {
    const { status, search, sortBy, order, limit = 50, offset = 0 } = req.query;

    const tenants = await Platform.getAllTenants({
      status,
      search,
      sortBy,
      order,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    const total = await Platform.getTenantCount({ status, search });

    res.json({
      tenants,
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get single tenant details
 * GET /api/platform/tenants/:id
 */
router.get('/tenants/:id', async (req, res, next) => {
  try {
    const tenant = await Platform.getTenantDetails(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(tenant);
  } catch (error) {
    next(error);
  }
});

/**
 * Update tenant info
 * PUT /api/platform/tenants/:id
 */
router.put(
  '/tenants/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('billingEmail').optional().isEmail().normalizeEmail(),
    body('billingCycle').optional().isIn(['monthly', 'yearly']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, phone, address, city, state, zipCode, website, billingEmail, billingCycle } = req.body;

      const tenant = await Tenant.update(req.params.id, {
        name,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        website,
      });

      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Log the action
      await Platform.logAudit(
        req.user.id,
        'tenant_updated',
        'tenant',
        req.params.id,
        { changes: req.body },
        req.ip,
        req.get('user-agent')
      );

      res.json(tenant);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Suspend a tenant
 * POST /api/platform/tenants/:id/suspend
 */
router.post(
  '/tenants/:id/suspend',
  [body('reason').trim().notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { reason } = req.body;

      const tenant = await Platform.suspendTenant(req.params.id, reason, req.user.id);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      res.json({ message: 'Tenant suspended successfully', tenant });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Activate a tenant
 * POST /api/platform/tenants/:id/activate
 */
router.post('/tenants/:id/activate', async (req, res, next) => {
  try {
    const tenant = await Platform.activateTenant(req.params.id, req.user.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({ message: 'Tenant activated successfully', tenant });
  } catch (error) {
    next(error);
  }
});

/**
 * Change tenant plan
 * POST /api/platform/tenants/:id/plan
 */
router.post(
  '/tenants/:id/plan',
  [body('planId').isInt()],
  validate,
  async (req, res, next) => {
    try {
      const { planId } = req.body;

      const tenant = await Platform.changeTenantPlan(req.params.id, planId, req.user.id);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      res.json({ message: 'Plan changed successfully', tenant });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete a tenant (DANGER!)
 * DELETE /api/platform/tenants/:id
 */
router.delete('/tenants/:id', async (req, res, next) => {
  try {
    // Safety check - verify tenant exists
    const tenant = await Platform.getTenantDetails(req.params.id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Require confirmation in request body
    if (req.body.confirm !== tenant.slug) {
      return res.status(400).json({
        error: 'Confirmation required',
        message: `To delete this tenant, send { "confirm": "${tenant.slug}" } in the request body`,
      });
    }

    await Platform.deleteTenant(req.params.id, req.user.id);

    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// USER MANAGEMENT
// =====================================================

/**
 * Get all users across all tenants
 * GET /api/platform/users
 */
router.get('/users', async (req, res, next) => {
  try {
    const { search, tenantId, isActive, limit = 50, offset = 0 } = req.query;

    const users = await Platform.getAllUsers({
      search,
      tenantId: tenantId ? parseInt(tenantId, 10) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
});

// =====================================================
// SUBSCRIPTION PLANS
// =====================================================

/**
 * Get all subscription plans
 * GET /api/platform/plans
 */
router.get('/plans', async (req, res, next) => {
  try {
    const plans = await Platform.getPlans();
    res.json(plans);
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new subscription plan
 * POST /api/platform/plans
 */
router.post(
  '/plans',
  [
    body('name').trim().notEmpty(),
    body('displayName').trim().notEmpty(),
    body('description').optional().trim(),
    body('priceMonthly').isNumeric(),
    body('priceYearly').isNumeric(),
    body('limits').isObject(),
    body('features').isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, displayName, description, priceMonthly, priceYearly, limits, features } = req.body;

      const plan = await Platform.createPlan({
        name,
        displayName,
        description,
        priceMonthly,
        priceYearly,
        limits,
        features,
      });

      // Log the action
      await Platform.logAudit(
        req.user.id,
        'plan_created',
        'plan',
        plan.id,
        { name, displayName, priceMonthly },
        req.ip,
        req.get('user-agent')
      );

      res.status(201).json(plan);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update a subscription plan
 * PUT /api/platform/plans/:id
 */
router.put(
  '/plans/:id',
  [
    body('displayName').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('priceMonthly').optional().isNumeric(),
    body('priceYearly').optional().isNumeric(),
    body('limits').optional().isObject(),
    body('features').optional().isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { displayName, description, priceMonthly, priceYearly, limits, features } = req.body;

      const plan = await Platform.updatePlan(req.params.id, {
        displayName,
        description,
        priceMonthly,
        priceYearly,
        limits,
        features,
      });

      if (!plan) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      // Log the action
      await Platform.logAudit(
        req.user.id,
        'plan_updated',
        'plan',
        req.params.id,
        { changes: req.body },
        req.ip,
        req.get('user-agent')
      );

      res.json(plan);
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// AUDIT LOG
// =====================================================

/**
 * Get platform audit log
 * GET /api/platform/audit-log
 */
router.get('/audit-log', async (req, res, next) => {
  try {
    const { action, adminUserId, limit = 50, offset = 0 } = req.query;

    const logs = await Platform.getAuditLog({
      action,
      adminUserId: adminUserId ? parseInt(adminUserId, 10) : undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
