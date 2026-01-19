const pool = require('../config/database');

const opportunityActivities = {
  // Get all activities for an opportunity
  async findByOpportunityId(opportunityId) {
    const query = `
      SELECT
        oa.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM opportunity_activities oa
      LEFT JOIN users u ON oa.created_by = u.id
      WHERE oa.opportunity_id = $1
      ORDER BY
        CASE WHEN oa.scheduled_at IS NOT NULL THEN 0 ELSE 1 END,
        oa.scheduled_at DESC,
        oa.created_at DESC
    `;

    const result = await pool.query(query, [opportunityId]);
    return result.rows;
  },

  // Get upcoming activities (tasks/meetings)
  async findUpcoming(userId = null, limit = 10) {
    const conditions = ['scheduled_at > CURRENT_TIMESTAMP', 'is_completed = false'];
    const params = [];
    let paramCount = 1;

    if (userId) {
      conditions.push(`oa.created_by = $${paramCount++}`);
      params.push(userId);
    }

    params.push(limit);

    const query = `
      SELECT
        oa.*,
        o.title as opportunity_title,
        o.client_name,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM opportunity_activities oa
      JOIN opportunities o ON oa.opportunity_id = o.id
      LEFT JOIN users u ON oa.created_by = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY oa.scheduled_at ASC
      LIMIT $${paramCount}
    `;

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Get overdue activities
  async findOverdue(userId = null) {
    const conditions = ['scheduled_at < CURRENT_TIMESTAMP', 'is_completed = false'];
    const params = [];
    let paramCount = 1;

    if (userId) {
      conditions.push(`oa.created_by = $${paramCount++}`);
      params.push(userId);
    }

    const query = `
      SELECT
        oa.*,
        o.title as opportunity_title,
        o.client_name,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM opportunity_activities oa
      JOIN opportunities o ON oa.opportunity_id = o.id
      LEFT JOIN users u ON oa.created_by = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY oa.scheduled_at ASC
    `;

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Create new activity
  async create(activityData, userId) {
    const {
      opportunity_id, activity_type, subject, notes,
      voice_note_url, voice_transcript,
      scheduled_at, reminder_at
    } = activityData;

    const query = `
      INSERT INTO opportunity_activities (
        opportunity_id, activity_type, subject, notes,
        voice_note_url, voice_transcript,
        scheduled_at, reminder_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await pool.query(query, [
      opportunity_id, activity_type, subject, notes,
      voice_note_url, voice_transcript,
      scheduled_at, reminder_at, userId
    ]);

    return result.rows[0];
  },

  // Update activity
  async update(id, activityData) {
    const {
      subject, notes, scheduled_at, reminder_at, is_completed, completed_at
    } = activityData;

    const query = `
      UPDATE opportunity_activities SET
        subject = COALESCE($1, subject),
        notes = COALESCE($2, notes),
        scheduled_at = COALESCE($3, scheduled_at),
        reminder_at = COALESCE($4, reminder_at),
        is_completed = COALESCE($5, is_completed),
        completed_at = COALESCE($6, completed_at),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `;

    const result = await pool.query(query, [
      subject, notes, scheduled_at, reminder_at, is_completed, completed_at, id
    ]);

    return result.rows[0];
  },

  // Mark as completed
  async markComplete(id) {
    const query = `
      UPDATE opportunity_activities
      SET is_completed = true, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0];
  },

  // Delete activity
  async delete(id) {
    const query = 'DELETE FROM opportunity_activities WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
};

module.exports = opportunityActivities;
