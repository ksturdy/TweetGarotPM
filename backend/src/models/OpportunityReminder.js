const db = require('../config/database');

const OpportunityReminder = {
  async create({ tenantId, opportunityId, userId, remindAt, note, recurrenceDays }) {
    const result = await db.query(
      `INSERT INTO opportunity_reminders
         (tenant_id, opportunity_id, user_id, remind_at, note, recurrence_days)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, opportunityId, userId, remindAt, note || null, recurrenceDays || null]
    );
    return result.rows[0];
  },

  async findByOpportunity(opportunityId, userId) {
    const result = await db.query(
      `SELECT * FROM opportunity_reminders
       WHERE opportunity_id = $1 AND user_id = $2
       ORDER BY remind_at ASC`,
      [opportunityId, userId]
    );
    return result.rows;
  },

  async delete(id, userId) {
    const result = await db.query(
      `DELETE FROM opportunity_reminders
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );
    return result.rows[0];
  },

  // Used by the cron job — finds all pending reminders across all tenants.
  async findPending(asOf) {
    const result = await db.query(
      `SELECT r.*,
              o.title          AS opportunity_title,
              o.estimated_value,
              o.client_company  AS company_name,
              ps.name           AS stage_name,
              asgn.first_name || ' ' || asgn.last_name AS owner_name,
              u.email, u.first_name, u.last_name
       FROM opportunity_reminders r
       JOIN opportunities o ON o.id = r.opportunity_id
       LEFT JOIN pipeline_stages ps ON ps.id = o.stage_id
       LEFT JOIN users asgn ON asgn.id = o.assigned_to
       JOIN users u ON u.id = r.user_id
       WHERE r.remind_at <= $1
         AND r.fired_at IS NULL
         AND u.is_active = true`,
      [asOf]
    );
    return result.rows;
  },

  // Advances a recurring reminder or stamps it as fired for one-shot.
  async markFired(id, recurrenceDays) {
    if (recurrenceDays) {
      await db.query(
        `UPDATE opportunity_reminders
         SET remind_at = remind_at + ($1 * INTERVAL '1 day'),
             fired_at  = NULL
         WHERE id = $2`,
        [recurrenceDays, id]
      );
    } else {
      await db.query(
        `UPDATE opportunity_reminders SET fired_at = NOW() WHERE id = $1`,
        [id]
      );
    }
  },
};

module.exports = OpportunityReminder;
