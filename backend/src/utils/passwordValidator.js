const { body } = require('express-validator');

// Centralized password policy constants
const PASSWORD_POLICY = {
  minLength: 8,
  maxHistoryCount: 5,
  maxAgeDays: 180,
  warningDays: 30,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
};

/**
 * Validate password strength against policy.
 * Returns { valid: boolean, errors: string[] }
 */
function validatePasswordStrength(password) {
  const errors = [];

  if (!password || password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Express-validator chain for password fields.
 * Use in route validation arrays: passwordValidationRules('password') or passwordValidationRules('newPassword')
 */
function passwordValidationRules(fieldName = 'password') {
  return [
    body(fieldName)
      .isLength({ min: PASSWORD_POLICY.minLength })
      .withMessage(`Password must be at least ${PASSWORD_POLICY.minLength} characters`)
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/)
      .withMessage('Password must contain at least one special character'),
  ];
}

module.exports = {
  PASSWORD_POLICY,
  validatePasswordStrength,
  passwordValidationRules,
};
