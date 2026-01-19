const pool = require('../config/database');

const Customers = {
  // Get all customers with optional filters
  async findAll(filters = {}) {
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters.customer_type) {
      query += ` AND customer_type = $${paramCount}`;
      params.push(filters.customer_type);
      paramCount++;
    }

    if (filters.search) {
      query += ` AND (customer_name ILIKE $${paramCount} OR company_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Get customer by ID
  async findById(id) {
    const result = await pool.query(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  // Create new customer
  async create(customerData, userId) {
    const {
      customer_name,
      company_name,
      email,
      phone,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      country,
      credit_limit,
      current_balance,
      payment_terms,
      tax_id,
      primary_contact,
      billing_email,
      status,
      customer_type,
      notes,
    } = customerData;

    const result = await pool.query(
      `INSERT INTO customers (
        customer_name, company_name, email, phone,
        address_line1, address_line2, city, state, zip_code, country,
        credit_limit, current_balance, payment_terms, tax_id,
        primary_contact, billing_email, status, customer_type, notes,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *`,
      [
        customer_name,
        company_name,
        email,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        country || 'USA',
        credit_limit,
        current_balance || 0.00,
        payment_terms,
        tax_id,
        primary_contact,
        billing_email,
        status || 'active',
        customer_type,
        notes,
        userId,
        userId,
      ]
    );
    return result.rows[0];
  },

  // Update customer
  async update(id, customerData, userId) {
    const {
      customer_name,
      company_name,
      email,
      phone,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      country,
      credit_limit,
      current_balance,
      payment_terms,
      tax_id,
      primary_contact,
      billing_email,
      status,
      customer_type,
      notes,
    } = customerData;

    const result = await pool.query(
      `UPDATE customers SET
        customer_name = COALESCE($1, customer_name),
        company_name = COALESCE($2, company_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        address_line1 = COALESCE($5, address_line1),
        address_line2 = COALESCE($6, address_line2),
        city = COALESCE($7, city),
        state = COALESCE($8, state),
        zip_code = COALESCE($9, zip_code),
        country = COALESCE($10, country),
        credit_limit = COALESCE($11, credit_limit),
        current_balance = COALESCE($12, current_balance),
        payment_terms = COALESCE($13, payment_terms),
        tax_id = COALESCE($14, tax_id),
        primary_contact = COALESCE($15, primary_contact),
        billing_email = COALESCE($16, billing_email),
        status = COALESCE($17, status),
        customer_type = COALESCE($18, customer_type),
        notes = COALESCE($19, notes),
        updated_by = $20
      WHERE id = $21
      RETURNING *`,
      [
        customer_name,
        company_name,
        email,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        country,
        credit_limit,
        current_balance,
        payment_terms,
        tax_id,
        primary_contact,
        billing_email,
        status,
        customer_type,
        notes,
        userId,
        id,
      ]
    );
    return result.rows[0];
  },

  // Delete customer
  async delete(id) {
    const result = await pool.query(
      'DELETE FROM customers WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },

  // Bulk insert customers (for Excel import)
  async bulkCreate(customersArray, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertedCustomers = [];

      for (const customer of customersArray) {
        const result = await client.query(
          `INSERT INTO customers (
            customer_name, company_name, email, phone,
            address_line1, address_line2, city, state, zip_code, country,
            credit_limit, current_balance, payment_terms, tax_id,
            primary_contact, billing_email, status, customer_type, notes,
            created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          RETURNING *`,
          [
            customer.customer_name,
            customer.company_name,
            customer.email,
            customer.phone,
            customer.address_line1,
            customer.address_line2,
            customer.city,
            customer.state,
            customer.zip_code,
            customer.country || 'USA',
            customer.credit_limit,
            customer.current_balance || 0.00,
            customer.payment_terms,
            customer.tax_id,
            customer.primary_contact,
            customer.billing_email,
            customer.status || 'active',
            customer.customer_type,
            customer.notes,
            userId,
            userId,
          ]
        );
        insertedCustomers.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return insertedCustomers;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = Customers;
