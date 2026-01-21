const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { authenticate } = require('../middleware/auth');

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
    body('password').isLength({ min: 8 }),
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

      const isMatch = await User.comparePassword(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

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

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, hrAccess: user.hr_access }, config.jwt.secret, {
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
          forcePasswordChange: user.force_password_change,
          twoFactorEnabled: user.two_factor_enabled,
        },
        token,
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

      // Issue JWT token
      const jwtToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, hrAccess: user.hr_access },
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
          forcePasswordChange: user.force_password_change,
          twoFactorEnabled: user.two_factor_enabled,
        },
        token: jwtToken,
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
    res.json(user);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
