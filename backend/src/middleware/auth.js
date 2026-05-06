const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../config/database');

const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_AGE_S = 10 * 60;
const lastSeenWrites = new Map();

/**
 * Authenticate user via JWT token.
 * Token can be in Authorization header (Bearer) or query parameter.
 * Verifies the user still exists and is active on every request, refreshes
 * last_seen_at (throttled), and re-issues a sliding-window token via the
 * X-New-Token response header.
 */
const authenticate = async (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  let row;
  try {
    const result = await db.query(
      'SELECT id, email, is_active, role, hr_access, tenant_id, is_platform_admin FROM users WHERE id = $1',
      [decoded.id]
    );
    row = result.rows[0];
  } catch (err) {
    return next(err);
  }

  if (!row) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (row.is_active === false) {
    return res.status(401).json({ error: 'Account is inactive' });
  }

  req.user = {
    id: row.id,
    email: row.email,
    role: row.role,
    hrAccess: row.hr_access,
    tenantId: row.tenant_id,
    isPlatformAdmin: row.is_platform_admin || false,
  };
  if (row.tenant_id) {
    req.tenantId = row.tenant_id;
  }

  const nowMs = Date.now();
  const lastWrite = lastSeenWrites.get(row.id) || 0;
  if (nowMs - lastWrite >= LAST_SEEN_THROTTLE_MS) {
    lastSeenWrites.set(row.id, nowMs);
    db.query('UPDATE users SET last_seen_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id])
      .catch((err) => console.error('[Auth] last_seen_at update failed:', err.message));
  }

  if (decoded.iat && nowMs / 1000 - decoded.iat > TOKEN_REFRESH_AGE_S) {
    const fresh = jwt.sign(
      {
        id: row.id,
        email: row.email,
        role: row.role,
        hrAccess: row.hr_access,
        tenantId: row.tenant_id,
        isPlatformAdmin: row.is_platform_admin || false,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    res.setHeader('X-New-Token', fresh);
  }

  next();
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

    if (req.user.role === 'admin') {
      return next();
    }

    const hrAccess = req.user.hrAccess;

    if (!hrAccess || hrAccess === 'none') {
      return res.status(403).json({ error: 'No HR access' });
    }

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
