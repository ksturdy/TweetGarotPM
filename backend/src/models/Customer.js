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
  }
};

module.exports = Customer;
