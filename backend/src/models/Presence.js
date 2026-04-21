const db = require('../config/database');

const Presence = {
  async upsert(userId, tenantId, status) {
    await db.query(`
      INSERT INTO user_presence (user_id, tenant_id, status, last_seen_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET status = $3, last_seen_at = NOW()
    `, [userId, tenantId, status]);
  },

  async getOnlineUsers(tenantId) {
    const result = await db.query(`
      SELECT up.user_id, up.status, up.last_seen_at,
             u.first_name, u.last_name
      FROM user_presence up
      JOIN users u ON u.id = up.user_id
      WHERE up.tenant_id = $1 AND up.status != 'offline'
      ORDER BY u.first_name, u.last_name
    `, [tenantId]);
    return result.rows;
  },

  async getAllPresence(tenantId) {
    const result = await db.query(`
      SELECT u.id as user_id, u.first_name, u.last_name,
             COALESCE(up.status, 'offline') as status,
             up.last_seen_at
      FROM users u
      LEFT JOIN user_presence up ON up.user_id = u.id
      WHERE u.tenant_id = $1 AND u.is_active = true
      ORDER BY
        CASE WHEN COALESCE(up.status, 'offline') = 'online' THEN 0
             WHEN COALESCE(up.status, 'offline') = 'away' THEN 1
             ELSE 2 END,
        u.first_name, u.last_name
    `, [tenantId]);
    return result.rows;
  },

  // Mark stale users as offline (for cleanup cron)
  async markStaleOffline(staleMinutes = 2) {
    const result = await db.query(`
      UPDATE user_presence
      SET status = 'offline'
      WHERE status != 'offline'
        AND last_seen_at < NOW() - INTERVAL '1 minute' * $1
      RETURNING user_id, tenant_id
    `, [staleMinutes]);
    return result.rows;
  },
};

module.exports = Presence;
