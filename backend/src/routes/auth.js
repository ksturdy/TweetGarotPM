const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { authenticate } = require('../middleware/auth');
const { getTenantById } = require('../middleware/tenant');
const { sendEmail, generatePasswordResetEmailHtml, generatePasswordResetEmailText } = require('../utils/emailService');
const { passwordValidationRules } = require('../utils/passwordValidator');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    ...passwordValidationRules('password'),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const user = await User.create({ email, password, firstName, lastName });
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, hrAccess: user.hr_access }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      });

      res.status(201).json({ user, token });
    } catch (error) {
      next(error);
    }
  }
);

// Login
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if user is active
      if (user.is_active === false) {
        return res.status(401).json({ error: 'Account is inactive. Please contact HR.' });
      }

      // Check account lockout
      const lockStatus = User.isAccountLocked(user);
      if (lockStatus.locked) {
        return res.status(423).json({
          error: `Account is locked due to too many failed attempts. Try again in ${lockStatus.remainingMinutes} minute(s).`,
          lockedMinutes: lockStatus.remainingMinutes,
        });
      }

      const isMatch = await User.comparePassword(password, user.password);
      if (!isMatch) {
        const lockResult = await User.incrementFailedAttempts(user.id);
        if (lockResult.locked) {
          await User.logSecurityEvent(user.id, 'account_locked', null, req.ip, req.get('User-Agent'),
            { reason: 'max_failed_attempts', attempts: lockResult.attempts });
          return res.status(423).json({
            error: 'Account has been locked due to too many failed attempts. Try again in 15 minutes.',
            lockedMinutes: 15,
          });
        }
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Successful password — reset failed attempts
      await User.resetFailedAttempts(user.id);

      // Check if 2FA is enabled
      if (user.two_factor_enabled) {
        // Don't issue token yet, require 2FA verification
        return res.json({
          requires2FA: true,
          userId: user.id,
          email: user.email,
        });
      }

      // Update last login
      await User.updateLastLogin(user.id);

      // Get tenant information
      const tenant = user.tenant_id ? await getTenantById(user.tenant_id) : null;

      // Check if tenant is active
      if (tenant && !tenant.is_active) {
        return res.status(401).json({ error: 'Your organization account is inactive. Please contact support.' });
      }

      // Check password aging
      const expiryStatus = User.checkPasswordExpired(user);
      let forcePasswordChange = user.force_password_change;
      if (expiryStatus.expired) {
        forcePasswordChange = true;
        // Persist the flag so it's enforced even if user navigates away
        const db = require('../config/database');
        await db.query('UPDATE users SET force_password_change = TRUE WHERE id = $1', [user.id]);
      }

      const token = jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        hrAccess: user.hr_access,
        tenantId: user.tenant_id,
        isPlatformAdmin: user.is_platform_admin || false,
      }, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          hrAccess: user.hr_access,
          forcePasswordChange,
          twoFactorEnabled: user.two_factor_enabled,
          tenantId: user.tenant_id,
          isPlatformAdmin: user.is_platform_admin || false,
        },
        tenant: tenant ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          settings: tenant.settings,
          planName: tenant.plan_display_name,
          planLimits: tenant.plan_limits,
          planFeatures: tenant.plan_features,
        } : null,
        token,
        ...(expiryStatus.warning && { passwordExpiresInDays: expiryStatus.daysUntilExpiry }),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Complete login with 2FA
router.post(
  '/login/2fa',
  [
    body('userId').isInt(),
    body('token').isLength({ min: 6 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { userId, token } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Get 2FA secret
      const user2FA = await User.get2FASecret(userId);
      if (!user2FA || !user2FA.two_factor_enabled) {
        return res.status(400).json({ error: '2FA not enabled for this user' });
      }

      // Verify token via security endpoint (reuse logic)
      const speakeasy = require('speakeasy');

      // Check if it's a backup code
      const isBackupCode = await User.verifyAndRemoveBackupCode(userId, token);
      let verified = false;

      if (isBackupCode) {
        verified = true;
        await User.logSecurityEvent(userId, 'backup_code_used', userId);
      } else {
        // Verify TOTP token
        verified = speakeasy.totp.verify({
          secret: user2FA.two_factor_secret,
          encoding: 'base32',
          token,
          window: 2,
        });

        if (verified) {
          await User.logSecurityEvent(userId, '2fa_used', userId);
        }
      }

      if (!verified) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }

      // Update last login
      await User.updateLastLogin(userId);

      // Get tenant information
      const tenant = user.tenant_id ? await getTenantById(user.tenant_id) : null;

      // Check if tenant is active
      if (tenant && !tenant.is_active) {
        return res.status(401).json({ error: 'Your organization account is inactive. Please contact support.' });
      }

      // Check password aging
      const expiryStatus = User.checkPasswordExpired(user);
      let forcePasswordChange = user.force_password_change;
      if (expiryStatus.expired) {
        forcePasswordChange = true;
        const db = require('../config/database');
        await db.query('UPDATE users SET force_password_change = TRUE WHERE id = $1', [user.id]);
      }

      // Issue JWT token
      const jwtToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          hrAccess: user.hr_access,
          tenantId: user.tenant_id,
          isPlatformAdmin: user.is_platform_admin || false,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          hrAccess: user.hr_access,
          forcePasswordChange,
          twoFactorEnabled: user.two_factor_enabled,
          tenantId: user.tenant_id,
          isPlatformAdmin: user.is_platform_admin || false,
        },
        tenant: tenant ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          settings: tenant.settings,
          planName: tenant.plan_display_name,
          planLimits: tenant.plan_limits,
          planFeatures: tenant.plan_features,
        } : null,
        token: jwtToken,
        ...(expiryStatus.warning && { passwordExpiresInDays: expiryStatus.daysUntilExpiry }),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get tenant information
    const tenant = user.tenant_id ? await getTenantById(user.tenant_id) : null;

    res.json({
      ...user,
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        settings: tenant.settings,
        planName: tenant.plan_display_name,
        planLimits: tenant.plan_limits,
        planFeatures: tenant.plan_features,
      } : null,
    });
  } catch (error) {
    next(error);
  }
});

// Forgot Password - Request reset email
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  validate,
  async (req, res, next) => {
    try {
      const { email } = req.body;

      // Always return success to prevent email enumeration
      const user = await User.findByEmail(email);

      if (user && user.is_active !== false) {
        // Create reset token
        const token = await User.createPasswordResetToken(user.id);

        // Build reset URL
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

        // Send email
        const emailResult = await sendEmail({
          to: user.email,
          subject: 'Password Reset Request - TITAN',
          html: generatePasswordResetEmailHtml(user, resetUrl),
          text: generatePasswordResetEmailText(user, resetUrl),
        });

        // Log security event
        await User.logSecurityEvent(user.id, 'password_reset_requested', null,
          req.ip, req.get('User-Agent'));

        if (!emailResult.success && !emailResult.preview) {
          console.error('Failed to send password reset email:', emailResult.error);
        }

        // Log reset URL in development for testing
        if (process.env.NODE_ENV !== 'production') {
          console.log('Password reset URL:', resetUrl);
        }
      }

      // Always return success (security: don't reveal if email exists)
      res.json({
        message: 'If an account exists with this email, you will receive a password reset link shortly.'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Reset Password - Set new password with token
router.post(
  '/reset-password',
  [
    body('token').notEmpty().isLength({ min: 64, max: 64 }),
    ...passwordValidationRules('password'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { token, password } = req.body;

      // Find valid token
      const resetToken = await User.findPasswordResetToken(token);

      if (!resetToken) {
        return res.status(400).json({
          error: 'Invalid or expired reset link. Please request a new password reset.'
        });
      }

      // Check password history
      const reused = await User.checkPasswordHistory(resetToken.user_id, password);
      if (reused) {
        return res.status(400).json({
          error: 'This password was used recently. Please choose a different password.'
        });
      }

      // Reset password (forceChange = false since user just set it)
      await User.resetPassword(resetToken.user_id, password, false);

      // Mark token as used
      await User.markTokenAsUsed(token);

      // Reset any lockout from failed attempts
      await User.resetFailedAttempts(resetToken.user_id);

      // Log security event
      await User.logSecurityEvent(resetToken.user_id, 'password_reset_completed', null,
        req.ip, req.get('User-Agent'));

      res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
