const db = require('../config/database');

const AssignmentNotification = {
  async create({ assignmentId, tenantId, channel, recipient, subject, body, status, error, sentBy }) {
    const result = await db.query(
      `INSERT INTO assignment_notifications
         (assignment_id, tenant_id, channel, recipient, subject, body, status, error, sent_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [assignmentId, tenantId, channel, recipient, subject || null, body || null,
       status || 'sent', error || null, sentBy || null]
    );
    return result.rows[0];
  },

  async findByAssignment(assignmentId, tenantId) {
    const result = await db.query(
      `SELECT n.*, u.first_name as sent_by_first_name, u.last_name as sent_by_last_name
       FROM assignment_notifications n
       LEFT JOIN users u ON u.id = n.sent_by
       WHERE n.assignment_id = $1 AND n.tenant_id = $2
       ORDER BY n.sent_at DESC`,
      [assignmentId, tenantId]
    );
    return result.rows;
  },
};

module.exports = AssignmentNotification;
