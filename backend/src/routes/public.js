/**
 * Public Routes
 * Handles tenant signup, slug checking, and public plan information
 * These routes do NOT require authentication
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const config = require('../config');
const db = require('../config/database');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * Check if a slug is available
 * GET /api/public/check-slug/:slug
 */
router.get('/check-slug/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      return res.json({
        available: false,
        reason: 'Slug can only contain lowercase letters, numbers, and hyphens',
      });
    }

    // Check reserved slugs
    const reservedSlugs = ['admin', 'api', 'app', 'www', 'mail', 'support', 'help', 'billing', 'login', 'signup', 'register'];
    if (reservedSlugs.includes(slug)) {
      return res.json({
        available: false,
        reason: 'This name is reserved',
      });
    }

    const isAvailable = await Tenant.isSlugAvailable(slug);
    res.json({
      available: isAvailable,
      reason: isAvailable ? null : 'This name is already taken',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get available subscription plans
 * GET /api/public/plans
 */
router.get('/plans', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, display_name, description, price_monthly, price_yearly, limits, features, display_order
       FROM subscription_plans
       WHERE is_active = TRUE
       ORDER BY display_order ASC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * Sign up a new tenant with admin user
 * POST /api/public/signup
 */
router.post(
  '/signup',
  [
    // Company info
    body('companyName').trim().notEmpty().withMessage('Company name is required'),
    body('slug')
      .trim()
      .notEmpty()
      .withMessage('URL slug is required')
      .matches(/^[a-z0-9-]+$/)
      .withMessage('Slug can only contain lowercase letters, numbers, and hyphens')
      .isLength({ min: 3, max: 50 })
      .withMessage('Slug must be between 3 and 50 characters'),

    // Admin user info
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),

    // Optional company details
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('city').optional().trim(),
    body('state').optional().trim(),
    body('zipCode').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    const client = await db.pool.connect();

    try {
      const {
        companyName,
        slug,
        firstName,
        lastName,
        email,
        password,
        phone,
        address,
        city,
        state,
        zipCode,
      } = req.body;

      // Start transaction
      await client.query('BEGIN');

      // Check if slug is available
      const slugCheck = await client.query(
        'SELECT id FROM tenants WHERE slug = $1',
        [slug]
      );
      if (slugCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This company URL is already taken' });
      }

      // Check if email is already registered
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      if (emailCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This email is already registered' });
      }

      // Create tenant
      const tenantResult = await client.query(
        `INSERT INTO tenants (name, slug, email, phone, address, city, state, zip_code, plan_id, settings)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)
         RETURNING *`,
        [
          companyName,
          slug,
          email,
          phone || null,
          address || null,
          city || null,
          state || null,
          zipCode || null,
          JSON.stringify({
            branding: {
              logo_url: null,
              primary_color: '#1976d2',
              company_name: companyName,
            },
            notifications: {
              email_enabled: true,
              daily_digest: false,
            },
            defaults: {
              timezone: 'America/Indiana/Indianapolis',
              date_format: 'MM/DD/YYYY',
            },
          }),
        ]
      );
      const tenant = tenantResult.rows[0];

      // Create admin user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);

      const userResult = await client.query(
        `INSERT INTO users (email, password, first_name, last_name, role, hr_access, tenant_id, force_password_change, password_changed_at)
         VALUES ($1, $2, $3, $4, 'admin', 'write', $5, FALSE, CURRENT_TIMESTAMP)
         RETURNING id, email, first_name, last_name, role, hr_access, tenant_id, created_at`,
        [email, hashedPassword, firstName, lastName, tenant.id]
      );
      const user = userResult.rows[0];

      // Create default tenant data (departments, office locations, pipeline stages)
      // Departments
      await client.query(
        `INSERT INTO departments (tenant_id, name, description)
         VALUES
           ($1, 'Executive', 'Executive leadership and management'),
           ($1, 'Operations', 'Field operations and project management'),
           ($1, 'Estimating', 'Project estimating and bidding'),
           ($1, 'Accounting', 'Finance and accounting'),
           ($1, 'Human Resources', 'HR and employee relations'),
           ($1, 'Safety', 'Safety and compliance'),
           ($1, 'Purchasing', 'Procurement and vendor management'),
           ($1, 'Service', 'Service and maintenance')`,
        [tenant.id]
      );

      // Default office location
      await client.query(
        `INSERT INTO office_locations (tenant_id, name, address, city, state, zip_code)
         VALUES ($1, 'Main Office', $2, $3, $4, $5)`,
        [tenant.id, address || '', city || '', state || '', zipCode || '']
      );

      // Pipeline stages (probability uses Low/Medium/High text values per migration 029)
      await client.query(
        `INSERT INTO pipeline_stages (tenant_id, name, display_order, color, probability)
         VALUES
           ($1, 'New Lead', 1, '#6B7280', 'Low'),
           ($1, 'Contacted', 2, '#3B82F6', 'Low'),
           ($1, 'Qualified', 3, '#8B5CF6', 'Medium'),
           ($1, 'Proposal Sent', 4, '#F59E0B', 'Medium'),
           ($1, 'Negotiation', 5, '#EF4444', 'High'),
           ($1, 'Won', 6, '#10B981', 'High'),
           ($1, 'Lost', 7, '#374151', NULL)`,
        [tenant.id]
      );

      // Commit transaction
      await client.query('COMMIT');

      // Get plan info
      const planResult = await db.query(
        'SELECT name, display_name, limits, features FROM subscription_plans WHERE id = $1',
        [tenant.plan_id]
      );
      const plan = planResult.rows[0];

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          hrAccess: user.hr_access,
          tenantId: tenant.id,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.status(201).json({
        message: 'Account created successfully',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          hrAccess: user.hr_access,
          tenantId: tenant.id,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          settings: tenant.settings,
          planName: plan.display_name,
          planLimits: plan.limits,
          planFeatures: plan.features,
        },
        token,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[Signup] Error:', error);
      next(error);
    } finally {
      client.release();
    }
  }
);

/**
 * Get tenant info by slug (for subdomain routing)
 * GET /api/public/tenant/:slug
 */
router.get('/tenant/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const tenant = await Tenant.findBySlug(slug);

    if (!tenant) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!tenant.is_active) {
      return res.status(403).json({ error: 'Organization is inactive' });
    }

    // Return public tenant info only (no sensitive data)
    res.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      settings: {
        branding: tenant.settings?.branding || {},
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
