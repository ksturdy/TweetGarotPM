const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Authenticate user via JWT token
 * Token can be in Authorization header (Bearer) or query parameter
 * Extracts user info including tenantId for multi-tenant context
 */
const authenticate = (req, res, next) => {
  // Check for token in Authorization header first, then query parameter
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    console.log('[Auth] No token provided. Auth header:', authHeader, 'Query token:', req.query.token);
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;

    // Also set tenantId directly on request for convenience
    if (decoded.tenantId) {
      req.tenantId = decoded.tenantId;
    }

    next();
  } catch (error) {
    console.log('[Auth] Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const authorizeHR = (requiredAccess = 'read') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admin always has full HR access
    if (req.user.role === 'admin') {
      return next();
    }

    // Check hr_access from JWT token
    const hrAccess = req.user.hrAccess;

    if (!hrAccess || hrAccess === 'none') {
      return res.status(403).json({ error: 'No HR access' });
    }

    // If write access is required, check for it
    if (requiredAccess === 'write' && hrAccess !== 'write') {
      return res.status(403).json({ error: 'HR write access required' });
    }

    next();
  };
};

/**
 * Platform admin authorization middleware
 * Only allows access to users with is_platform_admin = true
 */
const authorizePlatformAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.isPlatformAdmin) {
    return res.status(403).json({ error: 'Platform admin access required' });
  }

  next();
};

module.exports = { authenticate, authorize, authorizeHR, authorizePlatformAdmin };
