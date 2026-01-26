const db = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const User = {
  /**
   * Create a new user
   * @param {Object} userData - User data including tenantId for multi-tenant support
   */
  async create({ email, password, firstName, lastName, role = 'user', hrAccess = 'none', forcePasswordChange = true, tenantId }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (email, password, first_name, last_name, role, hr_access, force_password_change, password_changed_at, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8)
       RETURNING id, email, first_name, last_name, role, hr_access, force_password_change, tenant_id, created_at`,
      [email, hashedPassword, firstName, lastName, role, hrAccess, forcePasswordChange, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Find user by email (global lookup for login)
   */
  async findByEmail(email) {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  /**
   * Find user by email within a specific tenant
   */
  async findByEmailAndTenant(email, tenantId) {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1 AND tenant_id = $2',
      [email, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Find user by ID
   */
  async findById(id) {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, hr_access, is_active,
              two_factor_enabled, force_password_change, password_changed_at,
              last_login_at, tenant_id, is_platform_admin, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  },

  /**
   * Find user by ID with tenant check (security)
   */
  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, hr_access, is_active,
              two_factor_enabled, force_password_change, password_changed_at,
              last_login_at, tenant_id, is_platform_admin, created_at
       FROM users WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Find all users (global - admin only)
   */
  async findAll() {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, hr_access, is_active,
              two_factor_enabled, force_password_change, password_changed_at,
              last_login_at, tenant_id, created_at
       FROM users ORDER BY last_name, first_name`
    );
    return result.rows;
  },

  /**
   * Find all users within a tenant
   */
  async findAllByTenant(tenantId) {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, role, hr_access, is_active,
              two_factor_enabled, force_password_change, password_changed_at,
              last_login_at, tenant_id, created_at
       FROM users WHERE tenant_id = $1 ORDER BY last_name, first_name`,
      [tenantId]
    );
    return result.rows;
  },

  /**
   * Count users in a tenant (for limit checking)
   */
  async countByTenant(tenantId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE tenant_id = $1',
      [tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  async update(id, { email, firstName, lastName, role, hrAccess, isActive }, tenantId = null) {
    let query = `UPDATE users
       SET email = $1, first_name = $2, last_name = $3, role = $4, hr_access = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`;
    const params = [email, firstName, lastName, role, hrAccess, isActive, id];

    if (tenantId) {
      query += ' AND tenant_id = $8';
      params.push(tenantId);
    }

    query += ' RETURNING id, email, first_name, last_name, role, hr_access, is_active, created_at';

    const result = await db.query(query, params);
    return result.rows[0];
  },

  async updateStatus(id, isActive, tenantId = null) {
    let query = `UPDATE users
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`;
    const params = [isActive, id];

    if (tenantId) {
      query += ' AND tenant_id = $3';
      params.push(tenantId);
    }

    query += ' RETURNING id, email, first_name, last_name, role, hr_access, is_active, created_at';

    const result = await db.query(query, params);
    return result.rows[0];
  },

  async delete(id, tenantId = null) {
    let query = 'DELETE FROM users WHERE id = $1';
    const params = [id];

    if (tenantId) {
      query += ' AND tenant_id = $2';
      params.push(tenantId);
    }

    await db.query(query, params);
  },

  async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  },

  // Password management
  async changePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await db.query(
      `UPDATE users
       SET password = $1, password_changed_at = CURRENT_TIMESTAMP, force_password_change = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, first_name, last_name, role`,
      [hashedPassword, id]
    );
    return result.rows[0];
  },

  async resetPassword(id, newPassword, forceChange = true) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await db.query(
      `UPDATE users
       SET password = $1, password_changed_at = CURRENT_TIMESTAMP, force_password_change = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, first_name, last_name, role`,
      [hashedPassword, id, forceChange]
    );
    return result.rows[0];
  },

  async updateLastLogin(id) {
    await db.query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  },

  // 2FA methods
  async enable2FA(id, secret) {
    const result = await db.query(
      `UPDATE users
       SET two_factor_secret = $1, two_factor_enabled = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, two_factor_enabled`,
      [secret, id]
    );
    return result.rows[0];
  },

  async disable2FA(id) {
    const result = await db.query(
      `UPDATE users
       SET two_factor_secret = NULL, two_factor_enabled = FALSE, two_factor_backup_codes = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, email, two_factor_enabled`,
      [id]
    );
    return result.rows[0];
  },

  async get2FASecret(id) {
    const result = await db.query(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async setBackupCodes(id, codes) {
    // Hash each backup code before storing
    const hashedCodes = await Promise.all(
      codes.map(code => bcrypt.hash(code, 10))
    );
    await db.query(
      `UPDATE users SET two_factor_backup_codes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [hashedCodes, id]
    );
  },

  async getBackupCodes(id) {
    const result = await db.query(
      'SELECT two_factor_backup_codes FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0]?.two_factor_backup_codes || [];
  },

  async verifyAndRemoveBackupCode(id, code) {
    const hashedCodes = await this.getBackupCodes(id);

    for (let i = 0; i < hashedCodes.length; i++) {
      const isMatch = await bcrypt.compare(code, hashedCodes[i]);
      if (isMatch) {
        // Remove the used backup code
        hashedCodes.splice(i, 1);
        await db.query(
          `UPDATE users SET two_factor_backup_codes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [hashedCodes, id]
        );
        return true;
      }
    }
    return false;
  },

  // Password reset tokens
  async createPasswordResetToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );

    return token;
  },

  async findPasswordResetToken(token) {
    const result = await db.query(
      `SELECT prt.*, u.email, u.first_name, u.last_name
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = $1 AND prt.used = FALSE AND prt.expires_at > CURRENT_TIMESTAMP`,
      [token]
    );
    return result.rows[0];
  },

  async markTokenAsUsed(token) {
    await db.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE token = $1',
      [token]
    );
  },

  // Security audit logging
  async logSecurityEvent(userId, action, performedBy = null, ipAddress = null, userAgent = null, metadata = null) {
    await db.query(
      `INSERT INTO security_audit_log (user_id, action, performed_by, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, performedBy, ipAddress, userAgent, metadata]
    );
  },

  async getSecurityAuditLog(userId, limit = 50) {
    const result = await db.query(
      `SELECT sal.*, u.first_name || ' ' || u.last_name as performed_by_name
       FROM security_audit_log sal
       LEFT JOIN users u ON sal.performed_by = u.id
       WHERE sal.user_id = $1
       ORDER BY sal.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  },
};

module.exports = User;
