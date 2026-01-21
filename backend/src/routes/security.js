const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate, authorizeHR } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// Helper function to get IP address
const getIpAddress = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
};

// ============================================
// 2FA Endpoints
// ============================================

// Generate 2FA secret and QR code
router.post('/2fa/setup', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Tweet Garot PM (${user.email})`,
      issuer: 'Tweet Garot PM',
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret temporarily (will be confirmed when user verifies)
    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntry: secret.base32,
    });
  } catch (error) {
    next(error);
  }
});

// Verify and enable 2FA
router.post(
  '/2fa/enable',
  authenticate,
  [body('token').isLength({ min: 6, max: 6 }).isNumeric(), body('secret').notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, secret } = req.body;

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 time steps before/after
      });

      if (!verified) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }

      // Enable 2FA and save secret
      await User.enable2FA(req.user.id, secret);

      // Generate backup codes
      const backupCodes = [];
      for (let i = 0; i < 8; i++) {
        backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
      }

      await User.setBackupCodes(req.user.id, backupCodes);

      // Log the event
      await User.logSecurityEvent(
        req.user.id,
        '2fa_enabled',
        req.user.id,
        getIpAddress(req),
        req.headers['user-agent']
      );

      res.json({
        message: '2FA enabled successfully',
        backupCodes,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Disable 2FA
router.post(
  '/2fa/disable',
  authenticate,
  [body('password').notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { password } = req.body;

      // Verify password before disabling 2FA
      const user = await User.findByEmail(req.user.email);
      const isValidPassword = await User.comparePassword(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      await User.disable2FA(req.user.id);

      // Log the event
      await User.logSecurityEvent(
        req.user.id,
        '2fa_disabled',
        req.user.id,
        getIpAddress(req),
        req.headers['user-agent']
      );

      res.json({ message: '2FA disabled successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Verify 2FA token (used during login)
router.post(
  '/2fa/verify',
  [body('userId').isInt(), body('token').isLength({ min: 6, max: 6 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, token } = req.body;

      const user2FA = await User.get2FASecret(userId);

      if (!user2FA || !user2FA.two_factor_enabled) {
        return res.status(400).json({ error: '2FA not enabled for this user' });
      }

      // Check if it's a backup code first
      const isBackupCode = await User.verifyAndRemoveBackupCode(userId, token);

      if (isBackupCode) {
        // Log backup code usage
        await User.logSecurityEvent(
          userId,
          'backup_code_used',
          userId,
          getIpAddress(req),
          req.headers['user-agent']
        );

        return res.json({ verified: true, method: 'backup_code' });
      }

      // Verify TOTP token
      const verified = speakeasy.totp.verify({
        secret: user2FA.two_factor_secret,
        encoding: 'base32',
        token,
        window: 2,
      });

      if (verified) {
        // Log 2FA usage
        await User.logSecurityEvent(
          userId,
          '2fa_used',
          userId,
          getIpAddress(req),
          req.headers['user-agent']
        );
      }

      res.json({ verified, method: '2fa' });
    } catch (error) {
      next(error);
    }
  }
);

// Get 2FA status
router.get('/2fa/status', authenticate, async (req, res, next) => {
  try {
    const user2FA = await User.get2FASecret(req.user.id);
    const backupCodes = await User.getBackupCodes(req.user.id);

    res.json({
      enabled: user2FA?.two_factor_enabled || false,
      backupCodesRemaining: backupCodes.length,
    });
  } catch (error) {
    next(error);
  }
});

// Regenerate backup codes
router.post('/2fa/regenerate-backup-codes', authenticate, async (req, res, next) => {
  try {
    const user2FA = await User.get2FASecret(req.user.id);

    if (!user2FA?.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Generate new backup codes
    const backupCodes = [];
    for (let i = 0; i < 8; i++) {
      backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }

    await User.setBackupCodes(req.user.id, backupCodes);

    res.json({
      message: 'Backup codes regenerated successfully',
      backupCodes,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Password Management Endpoints
// ============================================

// Change password (user self-service)
router.post(
  '/password/change',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;

      // Verify current password
      const user = await User.findByEmail(req.user.email);
      const isValidPassword = await User.comparePassword(currentPassword, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      // Don't allow same password
      const isSamePassword = await User.comparePassword(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({ error: 'New password must be different from current password' });
      }

      // Change password
      await User.changePassword(req.user.id, newPassword);

      // Log the event
      await User.logSecurityEvent(
        req.user.id,
        'password_changed',
        req.user.id,
        getIpAddress(req),
        req.headers['user-agent']
      );

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// HR Admin Password Management
// ============================================

// Reset user password (HR Admin only)
router.post(
  '/password/reset/:userId',
  authenticate,
  authorizeHR('write'),
  [body('forceChange').optional().isBoolean()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { forceChange = true } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Generate temporary password
      const tempPassword = crypto.randomBytes(8).toString('hex');

      // Reset password
      await User.resetPassword(userId, tempPassword, forceChange);

      // Log the event
      await User.logSecurityEvent(
        userId,
        'password_reset',
        req.user.id,
        getIpAddress(req),
        req.headers['user-agent'],
        { reset_by_admin: true }
      );

      res.json({
        message: 'Password reset successfully',
        temporaryPassword: tempPassword,
        email: user.email,
        forceChange,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Force password change for user (HR Admin only)
router.post(
  '/password/force-change/:userId',
  authenticate,
  authorizeHR('write'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      await User.findById(userId); // Verify user exists

      await require('../config/database').query(
        'UPDATE users SET force_password_change = TRUE WHERE id = $1',
        [userId]
      );

      res.json({ message: 'User will be required to change password on next login' });
    } catch (error) {
      next(error);
    }
  }
);

// Disable 2FA for user (HR Admin only)
router.post(
  '/2fa/disable/:userId',
  authenticate,
  authorizeHR('write'),
  async (req, res, next) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await User.disable2FA(userId);

      // Log the event
      await User.logSecurityEvent(
        userId,
        '2fa_disabled',
        req.user.id,
        getIpAddress(req),
        req.headers['user-agent'],
        { disabled_by_admin: true }
      );

      res.json({ message: '2FA disabled successfully for user' });
    } catch (error) {
      next(error);
    }
  }
);

// Get security audit log (user can view their own, HR can view any)
router.get('/audit-log/:userId?', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const targetUserId = userId || req.user.id;

    // If viewing someone else's log, must have HR read access
    if (targetUserId != req.user.id) {
      // Check HR access
      if (req.user.role !== 'admin' && (!req.user.hrAccess || req.user.hrAccess === 'none')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    const logs = await User.getSecurityAuditLog(targetUserId);

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
