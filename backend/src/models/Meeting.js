const db = require('../config/database');

const Meeting = {
  // ─── Series ──────────────────────────────────────────────────────────────

  async createSeries({ tenantId, projectId, title, meetingType, recurrenceType, dayOfWeek, startTime, endTime, location, description, createdBy, carryOverStatuses }) {
    const result = await db.query(
      `INSERT INTO meeting_series
         (tenant_id, project_id, title, meeting_type, recurrence_type, day_of_week, start_time, end_time, location, description, created_by, carry_over_statuses)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [tenantId, projectId, title, meetingType || 'project_meeting', recurrenceType || 'weekly', dayOfWeek, startTime, endTime, location, description, createdBy, carryOverStatuses || ['open', 'in_progress', 'ongoing', 'on_hold', 'information']]
    );
    return result.rows[0];
  },

  async findSeriesByProject(projectId) {
    const result = await db.query(
      `SELECT s.*,
              u.first_name || ' ' || u.last_name AS created_by_name,
              (SELECT COUNT(*) FROM meetings m WHERE m.series_id = s.id) AS meeting_count,
              (SELECT MAX(m.scheduled_date) FROM meetings m WHERE m.series_id = s.id) AS last_meeting_date,
              (SELECT COUNT(*) FROM meeting_action_items ai
               JOIN meetings m ON ai.meeting_id = m.id
               WHERE m.series_id = s.id AND ai.status != 'closed') AS open_action_count
       FROM meeting_series s
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.project_id = $1
       ORDER BY s.title`,
      [projectId]
    );
    return result.rows;
  },

  async findSeriesById(id) {
    const result = await db.query('SELECT * FROM meeting_series WHERE id = $1', [id]);
    return result.rows[0];
  },

  async updateSeries(id, updates) {
    const fields = [];
    const values = [];
    let p = 1;
    const map = {
      title: 'title', meetingType: 'meeting_type', recurrenceType: 'recurrence_type',
      dayOfWeek: 'day_of_week', startTime: 'start_time', endTime: 'end_time',
      location: 'location', description: 'description', isActive: 'is_active',
      carry_over_statuses: 'carry_over_statuses', carryOverStatuses: 'carry_over_statuses',
    };
    Object.entries(updates).forEach(([k, v]) => {
      if (v !== undefined && map[k]) {
        fields.push(`${map[k]} = $${p++}`);
        values.push(v);
      }
    });
    if (!fields.length) return this.findSeriesById(id);
    values.push(id);
    const result = await db.query(
      `UPDATE meeting_series SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p} RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async deleteSeries(id) {
    await db.query('DELETE FROM meeting_series WHERE id = $1', [id]);
  },

  // ─── Meetings ─────────────────────────────────────────────────────────────

  async getNextNumber(projectId) {
    const result = await db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 AS next_number FROM meetings WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next_number;
  },

  async create({ tenantId, projectId, seriesId, previousMeetingId, number, title, meetingType, scheduledDate, startTime, endTime, location, description, createdBy }) {
    const result = await db.query(
      `INSERT INTO meetings
         (tenant_id, project_id, series_id, previous_meeting_id, number, title, meeting_type, scheduled_date, start_time, end_time, location, description, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
       RETURNING *`,
      [tenantId, projectId, seriesId || null, previousMeetingId || null, number, title, meetingType || 'project_meeting', scheduledDate, startTime, endTime, location, description, createdBy]
    );
    return this.findById(result.rows[0].id);
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT m.*,
             s.title AS series_title,
             s.recurrence_type AS series_recurrence,
             u.first_name || ' ' || u.last_name AS created_by_name,
             (SELECT COUNT(*) FROM meeting_action_items ai
              WHERE ai.meeting_id = m.id AND ai.status != 'closed') AS open_action_count,
             (SELECT COUNT(*) FROM meeting_attendees ma WHERE ma.meeting_id = m.id) AS attendee_count
      FROM meetings m
      LEFT JOIN meeting_series s ON m.series_id = s.id
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.project_id = $1
    `;
    const params = [projectId];
    if (filters.status) {
      params.push(filters.status);
      query += ` AND m.status = $${params.length}`;
    }
    if (filters.seriesId) {
      params.push(filters.seriesId);
      query += ` AND m.series_id = $${params.length}`;
    }
    query += ' ORDER BY m.scheduled_date DESC, m.number DESC';
    const result = await db.query(query, params);
    return result.rows;
  },

  async findById(id) {
    const meetingResult = await db.query(
      `SELECT m.*,
              s.title AS series_title,
              s.recurrence_type AS series_recurrence,
              s.day_of_week AS series_day_of_week,
              u.first_name || ' ' || u.last_name AS created_by_name,
              pm.number AS previous_meeting_number
       FROM meetings m
       LEFT JOIN meeting_series s ON m.series_id = s.id
       LEFT JOIN users u ON m.created_by = u.id
       LEFT JOIN meetings pm ON m.previous_meeting_id = pm.id
       WHERE m.id = $1`,
      [id]
    );
    if (!meetingResult.rows[0]) return null;
    const meeting = meetingResult.rows[0];

    const [attendees, agendaItems, actionItems] = await Promise.all([
      db.query(
        `SELECT ma.*,
                u.first_name || ' ' || u.last_name AS user_name,
                u.email AS user_email,
                c.first_name || ' ' || c.last_name AS contact_name,
                c.email AS contact_email,
                comp.name AS contact_company
         FROM meeting_attendees ma
         LEFT JOIN users u ON ma.user_id = u.id
         LEFT JOIN contacts c ON ma.contact_id = c.id
         LEFT JOIN companies comp ON c.company_id = comp.id
         WHERE ma.meeting_id = $1
         ORDER BY ma.id`,
        [id]
      ),
      db.query(
        'SELECT * FROM meeting_agenda_items WHERE meeting_id = $1 ORDER BY order_index, id',
        [id]
      ),
      db.query(
        `SELECT ai.*,
                u.first_name || ' ' || u.last_name AS assignee_user_name,
                ag.title AS agenda_item_title,
                om.number AS originated_meeting_number
         FROM meeting_action_items ai
         LEFT JOIN users u ON ai.assignee_id = u.id
         LEFT JOIN meeting_agenda_items ag ON ai.agenda_item_id = ag.id
         LEFT JOIN meetings om ON ai.originated_meeting_id = om.id
         WHERE ai.meeting_id = $1
         ORDER BY ai.order_index, ai.created_at`,
        [id]
      ),
    ]);

    meeting.attendees = attendees.rows;
    meeting.agenda_items = agendaItems.rows;
    meeting.action_items = actionItems.rows;
    return meeting;
  },

  async update(id, updates) {
    const fields = [];
    const values = [];
    let p = 1;
    const map = {
      title: 'title', meetingType: 'meeting_type', seriesId: 'series_id',
      scheduledDate: 'scheduled_date', startTime: 'start_time', endTime: 'end_time',
      location: 'location', description: 'description'
    };
    Object.entries(updates).forEach(([k, v]) => {
      if (v !== undefined && map[k]) {
        fields.push(`${map[k]} = $${p++}`);
        values.push(v);
      }
    });
    if (!fields.length) return this.findById(id);
    values.push(id);
    await db.query(
      `UPDATE meetings SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${p}`,
      values
    );
    return this.findById(id);
  },

  async publish(id) {
    await db.query(
      `UPDATE meetings SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
    return this.findById(id);
  },

  async close(id) {
    await db.query(
      `UPDATE meetings SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
    return this.findById(id);
  },

  async delete(id) {
    await db.query('DELETE FROM meetings WHERE id = $1', [id]);
  },

  // Carry-forward: create follow-up for a one-off (non-series) meeting (+1 week)
  async scheduleFollowup(meetingId, tenantId, userId) {
    const current = await this.findById(meetingId);
    if (!current) throw new Error('Meeting not found');

    const currentDate = current.scheduled_date ? new Date(current.scheduled_date) : new Date();
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 7);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    const nextNumber = await this.getNextNumber(current.project_id);

    const newResult = await db.query(
      `INSERT INTO meetings
         (tenant_id, project_id, previous_meeting_id, number, title, meeting_type,
          scheduled_date, start_time, end_time, location, description, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
       RETURNING id`,
      [tenantId, current.project_id, meetingId, nextNumber,
       current.title, current.meeting_type, nextDateStr, current.start_time,
       current.end_time, current.location, null, userId]
    );
    const newId = newResult.rows[0].id;

    if (current.attendees.length) {
      const attendeeValues = current.attendees.map((a, i) => {
        const base = i * 5;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, false)`;
      }).join(', ');
      const attendeeParams = current.attendees.flatMap(a => [newId, a.user_id, a.contact_id, a.name, a.company]);
      await db.query(
        `INSERT INTO meeting_attendees (meeting_id, user_id, contact_id, name, company, attended) VALUES ${attendeeValues}`,
        attendeeParams
      );
    }

    const agendaIdMap = {};
    for (const item of current.agenda_items) {
      const agResult = await db.query(
        `INSERT INTO meeting_agenda_items (meeting_id, order_index, title) VALUES ($1, $2, $3) RETURNING id`,
        [newId, item.order_index, item.title]
      );
      agendaIdMap[item.id] = agResult.rows[0].id;
    }

    const openItems = current.action_items.filter(ai => ai.status !== 'closed');
    for (let i = 0; i < openItems.length; i++) {
      const ai = openItems[i];
      const originatedId = ai.originated_meeting_id || meetingId;
      const newAgendaItemId = ai.agenda_item_id ? (agendaIdMap[ai.agenda_item_id] || null) : null;
      await db.query(
        `INSERT INTO meeting_action_items
           (meeting_id, agenda_item_id, order_index, originated_meeting_id, description, assignee_id, assignee_name, due_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [newId, newAgendaItemId, i, originatedId, ai.description, ai.assignee_id, ai.assignee_name, ai.due_date, ai.status]
      );
    }

    return this.findById(newId);
  },

  // Carry-forward: create next occurrence in a series
  async scheduleNext(meetingId, tenantId, userId) {
    const current = await this.findById(meetingId);
    if (!current || !current.series_id) throw new Error('Meeting has no series');

    const seriesRow = await this.findSeriesById(current.series_id);
    const carryOverStatuses = (seriesRow && seriesRow.carry_over_statuses && seriesRow.carry_over_statuses.length)
      ? seriesRow.carry_over_statuses
      : ['open', 'in_progress'];

    // Calculate next date
    const currentDate = current.scheduled_date ? new Date(current.scheduled_date) : new Date();
    const nextDate = new Date(currentDate);
    if (current.series_recurrence === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (current.series_recurrence === 'biweekly') {
      nextDate.setDate(nextDate.getDate() + 14);
    } else {
      // monthly
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    const nextDateStr = nextDate.toISOString().split('T')[0];

    const nextNumber = await this.getNextNumber(current.project_id);

    // Create new meeting
    const newResult = await db.query(
      `INSERT INTO meetings
         (tenant_id, project_id, series_id, previous_meeting_id, number, title, meeting_type,
          scheduled_date, start_time, end_time, location, description, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
       RETURNING id`,
      [tenantId, current.project_id, current.series_id, meetingId, nextNumber,
       current.title, current.meeting_type, nextDateStr, current.start_time,
       current.end_time, current.location, null, userId]
    );
    const newId = newResult.rows[0].id;

    // Copy attendees
    if (current.attendees.length) {
      const attendeeValues = current.attendees.map((a, i) => {
        const base = i * 5;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, false)`;
      }).join(', ');
      const attendeeParams = current.attendees.flatMap(a => [newId, a.user_id, a.contact_id, a.name, a.company]);
      await db.query(
        `INSERT INTO meeting_attendees (meeting_id, user_id, contact_id, name, company, attended) VALUES ${attendeeValues}`,
        attendeeParams
      );
    }

    // Copy agenda item titles (blank notes)
    const agendaIdMap = {};
    for (const item of current.agenda_items) {
      const agResult = await db.query(
        `INSERT INTO meeting_agenda_items (meeting_id, order_index, title) VALUES ($1, $2, $3) RETURNING id`,
        [newId, item.order_index, item.title]
      );
      agendaIdMap[item.id] = agResult.rows[0].id;
    }

    // Carry forward action items whose status matches the series carry_over_statuses setting
    const openItems = current.action_items.filter(ai => carryOverStatuses.includes(ai.status));
    for (let i = 0; i < openItems.length; i++) {
      const ai = openItems[i];
      const originatedId = ai.originated_meeting_id || meetingId;
      const newAgendaItemId = ai.agenda_item_id ? (agendaIdMap[ai.agenda_item_id] || null) : null;
      await db.query(
        `INSERT INTO meeting_action_items
           (meeting_id, agenda_item_id, order_index, originated_meeting_id, description, assignee_id, assignee_name, due_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [newId, newAgendaItemId, i, originatedId, ai.description, ai.assignee_id, ai.assignee_name, ai.due_date, ai.status]
      );
    }

    return this.findById(newId);
  },

  // ─── Attendees ────────────────────────────────────────────────────────────

  async addAttendee(meetingId, { userId, contactId, name, company, attended }) {
    const result = await db.query(
      `INSERT INTO meeting_attendees (meeting_id, user_id, contact_id, name, company, attended)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [meetingId, userId || null, contactId || null, name, company, attended === true]
    );
    return result.rows[0];
  },

  async updateAttendee(id, { attended, name, company }) {
    const result = await db.query(
      `UPDATE meeting_attendees SET
         attended = COALESCE($1, attended),
         name = COALESCE($2, name),
         company = COALESCE($3, company)
       WHERE id = $4
       RETURNING *`,
      [attended, name, company, id]
    );
    return result.rows[0];
  },

  async removeAttendee(id) {
    await db.query('DELETE FROM meeting_attendees WHERE id = $1', [id]);
  },

  // ─── Agenda Items ─────────────────────────────────────────────────────────

  async addAgendaItem(meetingId, { title, notes, orderIndex }) {
    const maxResult = await db.query(
      'SELECT COALESCE(MAX(order_index), -1) + 1 AS next_index FROM meeting_agenda_items WHERE meeting_id = $1',
      [meetingId]
    );
    const idx = orderIndex !== undefined ? orderIndex : maxResult.rows[0].next_index;
    const result = await db.query(
      `INSERT INTO meeting_agenda_items (meeting_id, order_index, title, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [meetingId, idx, title, notes || null]
    );
    return result.rows[0];
  },

  async updateAgendaItem(id, { title, notes }) {
    const result = await db.query(
      `UPDATE meeting_agenda_items SET
         title = COALESCE($1, title),
         notes = $2,
         updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [title, notes !== undefined ? notes : null, id]
    );
    return result.rows[0];
  },

  async deleteAgendaItem(id) {
    await db.query('DELETE FROM meeting_agenda_items WHERE id = $1', [id]);
  },

  async reorderAgendaItems(meetingId, orderedIds) {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.query(
        'UPDATE meeting_agenda_items SET order_index = $1 WHERE id = $2 AND meeting_id = $3',
        [i, orderedIds[i], meetingId]
      );
    }
  },

  // ─── Action Items ─────────────────────────────────────────────────────────

  async addActionItem(meetingId, { agenda_item_id, description, assignee_id, assignee_name, due_date, status }) {
    const maxResult = await db.query(
      'SELECT COALESCE(MAX(order_index), -1) + 1 AS next_index FROM meeting_action_items WHERE meeting_id = $1',
      [meetingId]
    );
    const orderIdx = maxResult.rows[0].next_index;
    const result = await db.query(
      `INSERT INTO meeting_action_items
         (meeting_id, agenda_item_id, order_index, description, assignee_id, assignee_name, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [meetingId, agenda_item_id || null, orderIdx, description, assignee_id || null, assignee_name || null, due_date || null, status || 'open']
    );
    return result.rows[0];
  },

  async reorderActionItems(meetingId, orderedIds) {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.query(
        'UPDATE meeting_action_items SET order_index = $1 WHERE id = $2 AND meeting_id = $3',
        [i, orderedIds[i], meetingId]
      );
    }
  },

  async updateActionItem(id, updates) {
    const setClauses = ['updated_at = NOW()'];
    const params = [];
    let idx = 1;

    const addField = (col, val) => {
      setClauses.push(`${col} = $${idx}`);
      params.push(val);
      idx++;
    };

    if ('agenda_item_id' in updates) addField('agenda_item_id', updates.agenda_item_id || null);
    if ('description' in updates) addField('description', updates.description);
    if ('assignee_id' in updates) addField('assignee_id', updates.assignee_id ?? null);
    if ('assignee_name' in updates) addField('assignee_name', updates.assignee_name ?? null);
    if ('due_date' in updates) addField('due_date', updates.due_date || null);
    if ('status' in updates) {
      addField('status', updates.status);
      if (updates.status === 'closed') setClauses.push('closed_at = NOW()');
    }

    params.push(id);
    const result = await db.query(
      `UPDATE meeting_action_items SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return result.rows[0];
  },

  async deleteActionItem(id) {
    await db.query('DELETE FROM meeting_action_items WHERE id = $1', [id]);
  },

  async findActionItemsByProject(projectId) {
    const result = await db.query(
      `WITH ranked AS (
         SELECT ai.id,
                ai.meeting_id,
                ai.agenda_item_id,
                ai.order_index,
                ai.originated_meeting_id,
                ai.description,
                ai.assignee_id,
                ai.assignee_name,
                ai.due_date,
                ai.status,
                ai.closed_at,
                ai.created_at,
                ai.updated_at,
                m.number AS meeting_number,
                m.title AS meeting_title,
                m.scheduled_date AS meeting_date,
                COALESCE(u.first_name || ' ' || u.last_name, ai.assignee_name) AS assignee_display,
                ag.title AS agenda_item_title,
                om.number AS originated_meeting_number,
                ROW_NUMBER() OVER (
                  PARTITION BY COALESCE(ai.originated_meeting_id, ai.meeting_id), ai.description
                  ORDER BY m.scheduled_date DESC NULLS LAST, ai.meeting_id DESC
                ) AS rn
         FROM meeting_action_items ai
         JOIN meetings m ON ai.meeting_id = m.id
         LEFT JOIN users u ON ai.assignee_id = u.id
         LEFT JOIN meeting_agenda_items ag ON ai.agenda_item_id = ag.id
         LEFT JOIN meetings om ON ai.originated_meeting_id = om.id
         WHERE m.project_id = $1
       )
       SELECT * FROM ranked
       WHERE rn = 1
       ORDER BY
         CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
         due_date ASC,
         meeting_date DESC NULLS LAST`,
      [projectId]
    );
    return result.rows;
  },
};

module.exports = Meeting;
