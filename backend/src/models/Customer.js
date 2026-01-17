const db = require('../config/database');

const Customer = {
  async findAll() {
    const result = await db.query(
      `SELECT * FROM customers ORDER BY customer_facility ASC`
    );
    return result.rows;
  },

  async findById(id) {
    const result = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async findByOwner(owner) {
    const result = await db.query(
      'SELECT * FROM customers WHERE customer_owner ILIKE $1 ORDER BY customer_facility ASC',
      [`%${owner}%`]
    );
    return result.rows;
  },

  async search(searchTerm) {
    const result = await db.query(
      `SELECT * FROM customers
       WHERE customer_facility ILIKE $1
          OR customer_owner ILIKE $1
          OR city ILIKE $1
          OR state ILIKE $1
       ORDER BY customer_facility ASC`,
      [`%${searchTerm}%`]
    );
    return result.rows;
  },

  async create(data) {
    const result = await db.query(
      `INSERT INTO customers (
        customer_facility, customer_owner, account_manager, field_leads,
        customer_number, address, city, state, zip_code,
        controls, department, customer_score, active_customer, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        data.customer_facility, data.customer_owner, data.account_manager, data.field_leads,
        data.customer_number, data.address, data.city, data.state, data.zip_code,
        data.controls, data.department, data.customer_score, data.active_customer, data.notes
      ]
    );
    return result.rows[0];
  },

  async bulkCreate(customers) {
    const inserted = [];
    for (const customer of customers) {
      const result = await this.create(customer);
      inserted.push(result);
    }
    return inserted;
  },

  async update(id, data) {
    const result = await db.query(
      `UPDATE customers SET
        customer_facility = $1, customer_owner = $2, account_manager = $3, field_leads = $4,
        customer_number = $5, address = $6, city = $7, state = $8, zip_code = $9,
        controls = $10, department = $11, customer_score = $12, active_customer = $13, notes = $14,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *`,
      [
        data.customer_facility, data.customer_owner, data.account_manager, data.field_leads,
        data.customer_number, data.address, data.city, data.state, data.zip_code,
        data.controls, data.department, data.customer_score, data.active_customer, data.notes,
        id
      ]
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM customers WHERE id = $1', [id]);
  },

  async deleteAll() {
    await db.query('DELETE FROM customers');
  },

  async getStats() {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_customers,
        COUNT(CASE WHEN active_customer = true THEN 1 END) as active_customers,
        COUNT(DISTINCT customer_owner) as unique_owners,
        COUNT(DISTINCT account_manager) as account_managers,
        COUNT(DISTINCT state) as states_covered
      FROM customers
    `);
    return result.rows[0];
  },

  async getMetrics(customerId) {
    const result = await db.query(`
      SELECT
        c.customer_score,
        COUNT(DISTINCT p.id) as total_projects,
        COALESCE(SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END), 0) as completed_projects,
        COUNT(DISTINCT e.id) as total_bids,
        COUNT(CASE WHEN e.status = 'won' THEN 1 END) as won_estimates,
        COUNT(CASE WHEN e.status IN ('won', 'lost') THEN 1 END) as decided_estimates,
        COALESCE(SUM(CASE WHEN e.status = 'won' THEN e.total_cost ELSE 0 END), 0) as total_revenue,
        CASE
          WHEN COUNT(DISTINCT e.id) > 0
          THEN ROUND((COUNT(CASE WHEN e.status = 'won' THEN 1 END)::numeric / COUNT(DISTINCT e.id)::numeric * 100), 2)
          ELSE 0
        END as hit_rate
      FROM customers c
      LEFT JOIN projects p ON p.customer_id = c.id
      LEFT JOIN estimates e ON e.customer_id = c.id
      WHERE c.id = $1
      GROUP BY c.id, c.customer_score
    `, [customerId]);

    return result.rows[0] || {
      customer_score: 0,
      total_projects: 0,
      completed_projects: 0,
      total_bids: 0,
      won_estimates: 0,
      decided_estimates: 0,
      total_revenue: 0,
      hit_rate: 0
    };
  },

  async getProjects(customerId) {
    const result = await db.query(`
      SELECT
        p.id,
        p.name,
        p.start_date as date,
        0 as value,
        0 as gm_percent,
        p.status,
        p.description
      FROM projects p
      WHERE p.customer_id = $1
      ORDER BY p.start_date DESC NULLS LAST
    `, [customerId]);
    return result.rows;
  },

  async getBids(customerId) {
    const result = await db.query(`
      SELECT
        e.id,
        e.estimate_number || ' - ' || e.project_name as name,
        e.bid_date as date,
        e.total_cost as value,
        CASE
          WHEN e.total_cost > 0 THEN ROUND((e.profit_amount / e.total_cost * 100)::numeric, 1)
          ELSE 0
        END as gm_percent,
        e.building_type,
        e.status
      FROM estimates e
      WHERE e.customer_id = $1
      ORDER BY e.bid_date DESC NULLS LAST, e.created_at DESC
    `, [customerId]);
    return result.rows;
  },

  async getTouchpoints(customerId) {
    const result = await db.query(`
      SELECT
        ct.*,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM customer_touchpoints ct
      LEFT JOIN users u ON ct.created_by = u.id
      WHERE ct.customer_id = $1
      ORDER BY ct.touchpoint_date DESC, ct.created_at DESC
    `, [customerId]);
    return result.rows;
  },

  async createTouchpoint(customerId, data) {
    const result = await db.query(`
      INSERT INTO customer_touchpoints (
        customer_id, touchpoint_date, touchpoint_type,
        contact_person, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      customerId,
      data.touchpoint_date,
      data.touchpoint_type,
      data.contact_person,
      data.notes,
      data.created_by
    ]);
    return result.rows[0];
  },

  async getAllContacts() {
    const result = await db.query(`
      SELECT
        cc.*,
        c.customer_facility,
        c.customer_owner,
        c.city,
        c.state
      FROM customer_contacts cc
      JOIN customers c ON cc.customer_id = c.id
      ORDER BY c.customer_facility ASC, cc.is_primary DESC, cc.last_name ASC, cc.first_name ASC
    `);
    return result.rows;
  },

  async getContacts(customerId) {
    const result = await db.query(`
      SELECT *
      FROM customer_contacts
      WHERE customer_id = $1
      ORDER BY is_primary DESC, last_name ASC, first_name ASC
    `, [customerId]);
    return result.rows;
  },

  async createContact(customerId, data) {
    const result = await db.query(`
      INSERT INTO customer_contacts (
        customer_id, first_name, last_name, title,
        email, phone, mobile, is_primary, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      customerId,
      data.first_name,
      data.last_name,
      data.title,
      data.email,
      data.phone,
      data.mobile,
      data.is_primary,
      data.notes
    ]);
    return result.rows[0];
  },

  async updateContact(contactId, data) {
    const result = await db.query(`
      UPDATE customer_contacts SET
        first_name = $1, last_name = $2, title = $3,
        email = $4, phone = $5, mobile = $6, is_primary = $7, notes = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [
      data.first_name,
      data.last_name,
      data.title,
      data.email,
      data.phone,
      data.mobile,
      data.is_primary,
      data.notes,
      contactId
    ]);
    return result.rows[0];
  },

  async deleteContact(contactId) {
    await db.query('DELETE FROM customer_contacts WHERE id = $1', [contactId]);
  }
};

module.exports = Customer;
