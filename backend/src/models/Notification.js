const db = require('../config/database');

const Notification = {
  async create({ tenantId, userId, entityType, entityId, eventType, title, message, link, createdBy, emailSent = false }) {
    const result = await db.query(
      `INSERT INTO notifications (tenant_id, user_id, entity_type, entity_id, event_type, title, message, link, created_by, email_sent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [tenantId, userId, entityType, entityId, eventType, title, message, link, createdBy, emailSent]
    );
    return result.rows[0];
  },

  async findByUser(userId, tenantId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
    let query = `
      SELECT n.*,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM notifications n
      LEFT JOIN users u ON n.created_by = u.id
      WHERE n.user_id = $1 AND n.tenant_id = $2
    `;
    const params = [userId, tenantId];

    if (unreadOnly) {
      query += ' AND n.read_at IS NULL';
    }

    query += ' ORDER BY n.created_at DESC';
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await db.query(query, params);
    return result.rows;
  },

  async countUnread(userId, tenantId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND tenant_id = $2 AND read_at IS NULL',
      [userId, tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  async markAsRead(id, userId) {
    const result = await db.query(
      `UPDATE notifications SET read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );
    return result.rows[0];
  },

  async markAllAsRead(userId, tenantId) {
    await db.query(
      `UPDATE notifications SET read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND tenant_id = $2 AND read_at IS NULL`,
      [userId, tenantId]
    );
  },

  async delete(id, userId) {
    const result = await db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    return result.rows[0];
  },

  async deleteAll(userId, tenantId) {
    await db.query(
      'DELETE FROM notifications WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );
  },
};

module.exports = Notification;
