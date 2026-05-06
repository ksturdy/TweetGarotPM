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
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.email AS user_email,
        e.job_title AS user_job_title
      FROM trade_show_attendees a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE a.trade_show_id = $1
      ORDER BY a.created_at ASC
    `, [tradeShowId]);
    return result.rows;
  },

  async addAttendee(tradeShowId, tenantId, data) {
    const result = await db.query(`
      INSERT INTO trade_show_attendees (
        trade_show_id, tenant_id,
        user_id, external_name, external_email, external_company,
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
      data.user_id || null,
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
        user_id = $1,
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
      data.user_id || null,
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
  }
};

module.exports = TradeShow;
