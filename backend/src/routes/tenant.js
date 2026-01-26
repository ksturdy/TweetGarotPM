/**
 * Tenant Routes
 * Handles tenant management, settings, and user management within a tenant
 * All routes require authentication
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext, loadTenant } = require('../middleware/tenant');
const crypto = require('crypto');
const db = require('../config/database');

const router = express.Router();

// All routes require authentication and tenant context
router.use(authenticate);
router.use(tenantContext);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// =====================================================
// TENANT INFO & SETTINGS
// =====================================================

/**
 * Get current tenant info
 * GET /api/tenant
 */
router.get('/', loadTenant, async (req, res, next) => {
  try {
    const usage = await Tenant.getUsageStats(req.tenantId);

    res.json({
      ...req.tenant,
      usage,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update tenant info
 * PUT /api/tenant
 */
router.put(
  '/',
  authorize('admin'),
  [
    body('name').optional().trim().notEmpty(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('city').optional().trim(),
    body('state').optional().trim(),
    body('zipCode').optional().trim(),
    body('website').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, phone, address, city, state, zipCode, website } = req.body;

      const tenant = await Tenant.update(req.tenantId, {
        name,
        email,
        phone,
        address,
        city,
        state,
        zipCode,
        website,
      });

      res.json(tenant);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update tenant settings (branding, notifications, etc)
 * PATCH /api/tenant/settings
 */
router.patch(
  '/settings',
  authorize('admin'),
  async (req, res, next) => {
    try {
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Settings object is required' });
      }

      const tenant = await Tenant.updateSettings(req.tenantId, settings);
      res.json(tenant);
    } catch (error) {
      next(error);
    }
  }
);

// =====================================================
// USER MANAGEMENT WITHIN TENANT
// =====================================================

/**
 * Get all users in tenant
 * GET /api/tenant/users
 */
router.get('/users', authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const users = await User.findAllByTenant(req.tenantId);
    res.json(users);
  } catch (error) {
    next(error);
  }
});

/**
 * Invite a new user to the tenant
 * POST /api/tenant/users/invite
 */
router.post(
  '/users/invite',
  authorize('admin'),
  [
    body('email').isEmail().normalizeEmail(),
    body('role').optional().isIn(['admin', 'manager', 'user']),
    body('hrAccess').optional().isIn(['none', 'read', 'write']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, role = 'user', hrAccess = 'none' } = req.body;

      // Check if user already exists in this tenant
      const existingUser = await User.findByEmailAndTenant(email, req.tenantId);
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists in this organization' });
      }

      // Check user limit
      const userCount = await User.countByTenant(req.tenantId);
      const tenant = await Tenant.findById(req.tenantId);
      const maxUsers = tenant.plan_limits?.max_users;

      if (maxUsers && userCount >= maxUsers) {
        return res.status(403).json({
          error: 'User limit reached',
          message: `Your plan allows a maximum of ${maxUsers} users`,
          upgradeRequired: true,
        });
      }

      // Generate invitation token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create invitation
      await db.query(
        `INSERT INTO user_invitations (tenant_id, email, role, token, invited_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, email) DO UPDATE
         SET token = $4, role = $3, invited_by = $5, expires_at = $6, accepted_at = NULL`,
        [req.tenantId, email, role, token, req.user.id, expiresAt]
      );

      // In a real app, you would send an email here with the invitation link
      // For now, return the token for testing
      res.status(201).json({
        message: 'Invitation sent',
        email,
        role,
        expiresAt,
        // Only include token in development for testing
        ...(process.env.NODE_ENV !== 'production' && { inviteToken: token }),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Accept an invitation and create user account
 * POST /api/tenant/users/accept-invite
 */
router.post(
  '/users/accept-invite',
  [
    body('token').notEmpty(),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('password')
      .isLength({ min: 8 })
      .matches(/[A-Z]/)
      .matches(/[a-z]/)
      .matches(/[0-9]/),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { token, firstName, lastName, password } = req.body;

      // Find invitation
      const inviteResult = await db.query(
        `SELECT * FROM user_invitations
         WHERE token = $1 AND accepted_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
        [token]
      );

      if (inviteResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired invitation' });
      }

      const invitation = inviteResult.rows[0];

      // Check if email already exists globally
      const existingUser = await User.findByEmail(invitation.email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already registered' });
      }

      // Create user
      const user = await User.create({
        email: invitation.email,
        password,
        firstName,
        lastName,
        role: invitation.role,
        hrAccess: 'none',
        tenantId: invitation.tenant_id,
        forcePasswordChange: false,
      });

      // Mark invitation as accepted
      await db.query(
        'UPDATE user_invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = $1',
        [invitation.id]
      );

      res.status(201).json({
        message: 'Account created successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update a user in the tenant
 * PUT /api/tenant/users/:userId
 */
router.put(
  '/users/:userId',
  authorize('admin'),
  [
    body('role').optional().isIn(['admin', 'manager', 'user']),
    body('hrAccess').optional().isIn(['none', 'read', 'write']),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { role, hrAccess, isActive } = req.body;

      // Verify user belongs to this tenant
      const user = await User.findByIdAndTenant(userId, req.tenantId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent removing last admin
      if (role && role !== 'admin' && user.role === 'admin') {
        const adminCount = await db.query(
          "SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND role = 'admin' AND is_active = TRUE",
          [req.tenantId]
        );
        if (parseInt(adminCount.rows[0].count, 10) <= 1) {
          return res.status(400).json({ error: 'Cannot remove the last admin' });
        }
      }

      // Update user
      const updatedUser = await db.query(
        `UPDATE users
         SET role = COALESCE($1, role),
             hr_access = COALESCE($2, hr_access),
             is_active = COALESCE($3, is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND tenant_id = $5
         RETURNING id, email, first_name, last_name, role, hr_access, is_active`,
        [role, hrAccess, isActive, userId, req.tenantId]
      );

      res.json(updatedUser.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Remove a user from the tenant
 * DELETE /api/tenant/users/:userId
 */
router.delete('/users/:userId', authorize('admin'), async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify user belongs to this tenant
    const user = await User.findByIdAndTenant(userId, req.tenantId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-deletion
    if (parseInt(userId, 10) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Prevent removing last admin
    if (user.role === 'admin') {
      const adminCount = await db.query(
        "SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND role = 'admin' AND is_active = TRUE",
        [req.tenantId]
      );
      if (parseInt(adminCount.rows[0].count, 10) <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin' });
      }
    }

    // Soft delete - deactivate instead of hard delete
    await db.query(
      'UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );

    res.json({ message: 'User removed successfully' });
  } catch (error) {
    next(error);
  }
});

// =====================================================
// USAGE & LIMITS
// =====================================================

/**
 * Get current usage vs plan limits
 * GET /api/tenant/usage
 */
router.get('/usage', loadTenant, async (req, res, next) => {
  try {
    const usage = await Tenant.getUsageStats(req.tenantId);
    const limits = req.tenant.plan_limits || {};

    res.json({
      usage,
      limits,
      plan: {
        name: req.tenant.plan_name,
        displayName: req.tenant.plan_display_name,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
