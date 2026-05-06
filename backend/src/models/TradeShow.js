const db = require('../config/database');

const TradeShow = {
  // ── Trade Show CRUD ──

  async findAllByTenant(tenantId, filters = {}) {
    let query = `
      SELECT ts.*,
        sl.first_name || ' ' || sl.last_name AS sales_lead_name,
        co.first_name || ' ' || co.last_name AS coordinator_name,
        cb.first_name || ' ' || cb.last_name AS created_by_name,
        (SELECT COUNT(*) FROM trade_show_attendees WHERE trade_show_id = ts.id) AS attendee_count
      FROM trade_shows ts
      LEFT JOIN users sl ON ts.sales_lead_id = sl.id
      LEFT JOIN users co ON ts.coordinator_id = co.id
      LEFT JOIN users cb ON ts.created_by = cb.id
      WHERE ts.tenant_id = $1
    `;
    const params = [tenantId];
    let idx = 2;

    if (filters.status) {
      query += ` AND ts.status = $${idx}`;
      params.push(filters.status);
      idx++;
    }

    if (filters.year) {
      query += ` AND EXTRACT(YEAR FROM ts.event_start_date) = $${idx}`;
      params.push(parseInt(filters.year));
      idx++;
    }

    if (filters.sales_lead_id) {
      query += ` AND ts.sales_lead_id = $${idx}`;
      params.push(parseInt(filters.sales_lead_id));
      idx++;
    }

    if (filters.coordinator_id) {
      query += ` AND ts.coordinator_id = $${idx}`;
      params.push(parseInt(filters.coordinator_id));
      idx++;
    }

    if (filters.search) {
      query += ` AND (ts.name ILIKE $${idx} OR ts.venue ILIKE $${idx} OR ts.city ILIKE $${idx})`;
      params.push(`%${filters.search}%`);
      idx++;
    }

    query += ' ORDER BY ts.event_start_date DESC NULLS LAST, ts.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async findByIdAndTenant(id, tenantId) {
    const showResult = await db.query(`
      SELECT ts.*,
        sl.first_name || ' ' || sl.last_name AS sales_lead_name,
        sl.email AS sales_lead_email,
        co.first_name || ' ' || co.last_name AS coordinator_name,
        co.email AS coordinator_email,
        cb.first_name || ' ' || cb.last_name AS created_by_name,
        ub.first_name || ' ' || ub.last_name AS updated_by_name
      FROM trade_shows ts
      LEFT JOIN users sl ON ts.sales_lead_id = sl.id
      LEFT JOIN users co ON ts.coordinator_id = co.id
      LEFT JOIN users cb ON ts.created_by = cb.id
      LEFT JOIN users ub ON ts.updated_by = ub.id
      WHERE ts.id = $1 AND ts.tenant_id = $2
    `, [id, tenantId]);

    if (showResult.rows.length === 0) return null;

    const show = showResult.rows[0];
    show.attendees = await this.getAttendees(id);
    show.expenses = await this.getExpenses(id);
    show.todos = await this.getTodos(id);
    return show;
  },

  async create(data, tenantId, userId) {
    const result = await db.query(`
      INSERT INTO trade_shows (
        tenant_id, name, description, status,
        venue, city, state, country, address,
        event_start_date, event_end_date, event_start_time, event_end_time, registration_deadline,
        registration_cost, booth_cost, travel_budget, total_budget,
        booth_number, booth_size, website_url, notes,
        sales_lead_id, coordinator_id,
        created_by, updated_by
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24,
        $25, $26
      )
      RETURNING *
    `, [
      tenantId,
      data.name,
      data.description || null,
      data.status || 'upcoming',
      data.venue || null,
      data.city || null,
      data.state || null,
      data.country || null,
      data.address || null,
      data.event_start_date || null,
      data.event_end_date || null,
      data.event_start_time || null,
      data.event_end_time || null,
      data.registration_deadline || null,
      data.registration_cost ?? null,
      data.booth_cost ?? null,
      data.travel_budget ?? null,
      data.total_budget ?? null,
      data.booth_number || null,
      data.booth_size || null,
      data.website_url || null,
      data.notes || null,
      data.sales_lead_id || null,
      data.coordinator_id || null,
      userId || null,
      userId || null
    ]);
    return result.rows[0];
  },

  async update(id, data, tenantId, userId) {
    const result = await db.query(`
      UPDATE trade_shows SET
        name = $1,
        description = $2,
        status = $3,
        venue = $4,
        city = $5,
        state = $6,
        country = $7,
        address = $8,
        event_start_date = $9,
        event_end_date = $10,
        event_start_time = $11,
        event_end_time = $12,
        registration_deadline = $13,
        registration_cost = $14,
        booth_cost = $15,
        travel_budget = $16,
        total_budget = $17,
        booth_number = $18,
        booth_size = $19,
        website_url = $20,
        notes = $21,
        sales_lead_id = $22,
        coordinator_id = $23,
        updated_by = $24,
        updated_at = NOW()
      WHERE id = $25 AND tenant_id = $26
      RETURNING *
    `, [
      data.name,
      data.description || null,
      data.status || 'upcoming',
      data.venue || null,
      data.city || null,
      data.state || null,
      data.country || null,
      data.address || null,
      data.event_start_date || null,
      data.event_end_date || null,
      data.event_start_time || null,
      data.event_end_time || null,
      data.registration_deadline || null,
      data.registration_cost ?? null,
      data.booth_cost ?? null,
      data.travel_budget ?? null,
      data.total_budget ?? null,
      data.booth_number || null,
      data.booth_size || null,
      data.website_url || null,
      data.notes || null,
      data.sales_lead_id || null,
      data.coordinator_id || null,
      userId || null,
      id,
      tenantId
    ]);
    return result.rows[0];
  },

  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM trade_shows WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    return result.rows[0];
  },

  async verifyOwnership(id, tenantId) {
    const result = await db.query(
      'SELECT id FROM trade_shows WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows.length > 0;
  },

  // ── Attendee CRUD ──

  async getAttendees(tradeShowId) {
    const result = await db.query(`
      SELECT a.*,
        e.first_name AS employee_first_name,
        e.last_name AS employee_last_name,
        e.email AS employee_email,
        e.job_title AS employee_job_title,
        e.department_name AS employee_department,
        e.user_id AS employee_user_id
      FROM trade_show_attendees a
      LEFT JOIN (
        SELECT emp.*, d.name AS department_name
        FROM employees emp
        LEFT JOIN departments d ON emp.department_id = d.id
      ) e ON a.employee_id = e.id
      WHERE a.trade_show_id = $1
      ORDER BY a.created_at ASC
    `, [tradeShowId]);
    return result.rows;
  },

  async addAttendee(tradeShowId, tenantId, data) {
    const result = await db.query(`
      INSERT INTO trade_show_attendees (
        trade_show_id, tenant_id,
        employee_id, external_name, external_email, external_company,
        role, registration_status, arrival_date, departure_date, notes
      ) VALUES (
        $1, $2,
        $3, $4, $5, $6,
        $7, $8, $9, $10, $11
      )
      RETURNING *
    `, [
      tradeShowId,
      tenantId,
      data.employee_id || null,
      data.external_name || null,
      data.external_email || null,
      data.external_company || null,
      data.role || null,
      data.registration_status || 'pending',
      data.arrival_date || null,
      data.departure_date || null,
      data.notes || null
    ]);
    return result.rows[0];
  },

  async updateAttendee(attendeeId, tradeShowId, data) {
    const result = await db.query(`
      UPDATE trade_show_attendees SET
        employee_id = $1,
        external_name = $2,
        external_email = $3,
        external_company = $4,
        role = $5,
        registration_status = $6,
        arrival_date = $7,
        departure_date = $8,
        notes = $9,
        updated_at = NOW()
      WHERE id = $10 AND trade_show_id = $11
      RETURNING *
    `, [
      data.employee_id || null,
      data.external_name || null,
      data.external_email || null,
      data.external_company || null,
      data.role || null,
      data.registration_status || 'pending',
      data.arrival_date || null,
      data.departure_date || null,
      data.notes || null,
      attendeeId,
      tradeShowId
    ]);
    return result.rows[0];
  },

  async deleteAttendee(attendeeId, tradeShowId) {
    const result = await db.query(
      'DELETE FROM trade_show_attendees WHERE id = $1 AND trade_show_id = $2 RETURNING id',
      [attendeeId, tradeShowId]
    );
    return result.rows[0];
  },

  // ── Expense CRUD ──

  async getExpenses(tradeShowId) {
    const result = await db.query(`
      SELECT e.*,
        cb.first_name || ' ' || cb.last_name AS created_by_name
      FROM trade_show_expenses e
      LEFT JOIN users cb ON e.created_by = cb.id
      WHERE e.trade_show_id = $1
      ORDER BY e.expense_date DESC NULLS LAST, e.created_at ASC
    `, [tradeShowId]);
    return result.rows;
  },

  async addExpense(tradeShowId, tenantId, data, userId) {
    const result = await db.query(`
      INSERT INTO trade_show_expenses (
        trade_show_id, tenant_id,
        category, description, vendor, amount, expense_date, notes,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      tradeShowId,
      tenantId,
      data.category || 'other',
      data.description || null,
      data.vendor || null,
      data.amount ?? 0,
      data.expense_date || null,
      data.notes || null,
      userId || null,
      userId || null,
    ]);
    return result.rows[0];
  },

  async updateExpense(expenseId, tradeShowId, data, userId) {
    const result = await db.query(`
      UPDATE trade_show_expenses SET
        category = $1,
        description = $2,
        vendor = $3,
        amount = $4,
        expense_date = $5,
        notes = $6,
        updated_by = $7,
        updated_at = NOW()
      WHERE id = $8 AND trade_show_id = $9
      RETURNING *
    `, [
      data.category || 'other',
      data.description || null,
      data.vendor || null,
      data.amount ?? 0,
      data.expense_date || null,
      data.notes || null,
      userId || null,
      expenseId,
      tradeShowId,
    ]);
    return result.rows[0];
  },

  async deleteExpense(expenseId, tradeShowId) {
    const result = await db.query(
      'DELETE FROM trade_show_expenses WHERE id = $1 AND trade_show_id = $2 RETURNING id',
      [expenseId, tradeShowId]
    );
    return result.rows[0];
  },

  // ── To-Do CRUD ──

  async getTodos(tradeShowId) {
    const result = await db.query(`
      SELECT t.*,
        a.first_name || ' ' || a.last_name AS assigned_to_name,
        a.email AS assigned_to_email,
        cb.first_name || ' ' || cb.last_name AS created_by_name
      FROM trade_show_todos t
      LEFT JOIN users a ON t.assigned_to_user_id = a.id
      LEFT JOIN users cb ON t.created_by = cb.id
      WHERE t.trade_show_id = $1
      ORDER BY
        CASE t.status WHEN 'done' THEN 1 ELSE 0 END,
        t.due_date ASC NULLS LAST,
        t.due_time ASC NULLS LAST,
        t.created_at ASC
    `, [tradeShowId]);
    return result.rows;
  },

  async getTodoById(todoId, tradeShowId) {
    const result = await db.query(`
      SELECT t.*,
        a.first_name || ' ' || a.last_name AS assigned_to_name,
        a.email AS assigned_to_email
      FROM trade_show_todos t
      LEFT JOIN users a ON t.assigned_to_user_id = a.id
      WHERE t.id = $1 AND t.trade_show_id = $2
    `, [todoId, tradeShowId]);
    return result.rows[0] || null;
  },

  async addTodo(tradeShowId, tenantId, data, userId) {
    const result = await db.query(`
      INSERT INTO trade_show_todos (
        trade_show_id, tenant_id,
        title, description, status, priority,
        due_date, due_time,
        reminder_offset_minutes,
        assigned_to_user_id,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      tradeShowId,
      tenantId,
      data.title,
      data.description || null,
      data.status || 'open',
      data.priority || 'normal',
      data.due_date || null,
      data.due_time || null,
      data.reminder_offset_minutes ?? null,
      data.assigned_to_user_id || null,
      userId || null,
      userId || null,
    ]);
    return result.rows[0];
  },

  async updateTodo(todoId, tradeShowId, data, userId) {
    // Clear reminder_sent_at if due date/time or offset changed so it fires again.
    const existing = await db.query(
      'SELECT due_date, due_time, reminder_offset_minutes FROM trade_show_todos WHERE id = $1 AND trade_show_id = $2',
      [todoId, tradeShowId]
    );
    if (existing.rows.length === 0) return null;
    const prev = existing.rows[0];
    const dueChanged =
      String(prev.due_date || '') !== String(data.due_date || '') ||
      String(prev.due_time || '') !== String(data.due_time || '') ||
      (prev.reminder_offset_minutes ?? null) !== (data.reminder_offset_minutes ?? null);

    const transitioningToDone = data.status === 'done';
    const completedAtClause = transitioningToDone
      ? 'COALESCE(completed_at, NOW())'
      : 'NULL';
    const completedByClause = transitioningToDone
      ? `COALESCE(completed_by, $${12})`
      : 'NULL';

    const result = await db.query(`
      UPDATE trade_show_todos SET
        title = $1,
        description = $2,
        status = $3,
        priority = $4,
        due_date = $5,
        due_time = $6,
        reminder_offset_minutes = $7,
        assigned_to_user_id = $8,
        reminder_sent_at = CASE WHEN $9::boolean THEN NULL ELSE reminder_sent_at END,
        completed_at = ${completedAtClause},
        completed_by = ${completedByClause},
        updated_by = $10,
        updated_at = NOW()
      WHERE id = $11 AND trade_show_id = $13
      RETURNING *
    `, [
      data.title,
      data.description || null,
      data.status || 'open',
      data.priority || 'normal',
      data.due_date || null,
      data.due_time || null,
      data.reminder_offset_minutes ?? null,
      data.assigned_to_user_id || null,
      dueChanged,
      userId || null,
      todoId,
      userId || null,
      tradeShowId,
    ]);
    return result.rows[0];
  },

  async deleteTodo(todoId, tradeShowId) {
    const result = await db.query(
      'DELETE FROM trade_show_todos WHERE id = $1 AND trade_show_id = $2 RETURNING id',
      [todoId, tradeShowId]
    );
    return result.rows[0];
  },

  /**
   * Find todos whose reminder window has arrived but not yet been sent.
   * Used by the reminder cron job.
   */
  async findPendingReminders(now = new Date()) {
    const result = await db.query(`
      SELECT t.id, t.trade_show_id, t.tenant_id, t.title, t.description,
        t.due_date, t.due_time, t.reminder_offset_minutes,
        t.assigned_to_user_id, t.created_by, t.priority,
        ts.name AS trade_show_name,
        ts.coordinator_id, ts.sales_lead_id
      FROM trade_show_todos t
      JOIN trade_shows ts ON ts.id = t.trade_show_id
      WHERE t.reminder_sent_at IS NULL
        AND t.reminder_offset_minutes IS NOT NULL
        AND t.status <> 'done'
        AND t.due_date IS NOT NULL
        AND ((t.due_date::timestamp + COALESCE(t.due_time, '00:00')::time)
             - (t.reminder_offset_minutes || ' minutes')::interval) <= $1
    `, [now]);
    return result.rows;
  },

  async markReminderSent(todoId) {
    await db.query(
      'UPDATE trade_show_todos SET reminder_sent_at = NOW() WHERE id = $1',
      [todoId]
    );
  },
};

module.exports = TradeShow;
