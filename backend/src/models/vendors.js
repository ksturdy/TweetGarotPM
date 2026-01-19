const pool = require('../config/database');

const Vendors = {
  // Get all vendors with optional filters
  async findAll(filters = {}) {
    let query = 'SELECT * FROM vendors WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.status) {
      query += ` AND status = $${paramCount}`;
      params.push(filters.status);
      paramCount++;
    }

    if (filters.vendor_type) {
      query += ` AND vendor_type = $${paramCount}`;
      params.push(filters.vendor_type);
      paramCount++;
    }

    if (filters.trade_specialty) {
      query += ` AND trade_specialty = $${paramCount}`;
      params.push(filters.trade_specialty);
      paramCount++;
    }

    if (filters.search) {
      query += ` AND (vendor_name ILIKE $${paramCount} OR company_name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Get vendor by ID
  async findById(id) {
    const result = await pool.query(
      'SELECT * FROM vendors WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  // Create new vendor
  async create(vendorData, userId) {
    const {
      vendor_name,
      company_name,
      email,
      phone,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      country,
      payment_terms,
      tax_id,
      w9_on_file,
      vendor_type,
      trade_specialty,
      insurance_expiry,
      license_number,
      license_expiry,
      primary_contact,
      accounts_payable_contact,
      accounts_payable_email,
      rating,
      status,
      notes,
    } = vendorData;

    const result = await pool.query(
      `INSERT INTO vendors (
        vendor_name, company_name, email, phone,
        address_line1, address_line2, city, state, zip_code, country,
        payment_terms, tax_id, w9_on_file, vendor_type, trade_specialty,
        insurance_expiry, license_number, license_expiry,
        primary_contact, accounts_payable_contact, accounts_payable_email,
        rating, status, notes,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *`,
      [
        vendor_name,
        company_name,
        email,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        country || 'USA',
        payment_terms,
        tax_id,
        w9_on_file || false,
        vendor_type,
        trade_specialty,
        insurance_expiry,
        license_number,
        license_expiry,
        primary_contact,
        accounts_payable_contact,
        accounts_payable_email,
        rating,
        status || 'active',
        notes,
        userId,
        userId,
      ]
    );
    return result.rows[0];
  },

  // Update vendor
  async update(id, vendorData, userId) {
    const {
      vendor_name,
      company_name,
      email,
      phone,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      country,
      payment_terms,
      tax_id,
      w9_on_file,
      vendor_type,
      trade_specialty,
      insurance_expiry,
      license_number,
      license_expiry,
      primary_contact,
      accounts_payable_contact,
      accounts_payable_email,
      rating,
      status,
      notes,
    } = vendorData;

    const result = await pool.query(
      `UPDATE vendors SET
        vendor_name = COALESCE($1, vendor_name),
        company_name = COALESCE($2, company_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        address_line1 = COALESCE($5, address_line1),
        address_line2 = COALESCE($6, address_line2),
        city = COALESCE($7, city),
        state = COALESCE($8, state),
        zip_code = COALESCE($9, zip_code),
        country = COALESCE($10, country),
        payment_terms = COALESCE($11, payment_terms),
        tax_id = COALESCE($12, tax_id),
        w9_on_file = COALESCE($13, w9_on_file),
        vendor_type = COALESCE($14, vendor_type),
        trade_specialty = COALESCE($15, trade_specialty),
        insurance_expiry = COALESCE($16, insurance_expiry),
        license_number = COALESCE($17, license_number),
        license_expiry = COALESCE($18, license_expiry),
        primary_contact = COALESCE($19, primary_contact),
        accounts_payable_contact = COALESCE($20, accounts_payable_contact),
        accounts_payable_email = COALESCE($21, accounts_payable_email),
        rating = COALESCE($22, rating),
        status = COALESCE($23, status),
        notes = COALESCE($24, notes),
        updated_by = $25
      WHERE id = $26
      RETURNING *`,
      [
        vendor_name,
        company_name,
        email,
        phone,
        address_line1,
        address_line2,
        city,
        state,
        zip_code,
        country,
        payment_terms,
        tax_id,
        w9_on_file,
        vendor_type,
        trade_specialty,
        insurance_expiry,
        license_number,
        license_expiry,
        primary_contact,
        accounts_payable_contact,
        accounts_payable_email,
        rating,
        status,
        notes,
        userId,
        id,
      ]
    );
    return result.rows[0];
  },

  // Delete vendor
  async delete(id) {
    const result = await pool.query(
      'DELETE FROM vendors WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  },

  // Bulk insert vendors (for Excel import)
  async bulkCreate(vendorsArray, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const insertedVendors = [];

      for (const vendor of vendorsArray) {
        const result = await client.query(
          `INSERT INTO vendors (
            vendor_name, company_name, email, phone,
            address_line1, address_line2, city, state, zip_code, country,
            payment_terms, tax_id, w9_on_file, vendor_type, trade_specialty,
            insurance_expiry, license_number, license_expiry,
            primary_contact, accounts_payable_contact, accounts_payable_email,
            rating, status, notes,
            created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
          RETURNING *`,
          [
            vendor.vendor_name,
            vendor.company_name,
            vendor.email,
            vendor.phone,
            vendor.address_line1,
            vendor.address_line2,
            vendor.city,
            vendor.state,
            vendor.zip_code,
            vendor.country || 'USA',
            vendor.payment_terms,
            vendor.tax_id,
            vendor.w9_on_file || false,
            vendor.vendor_type,
            vendor.trade_specialty,
            vendor.insurance_expiry,
            vendor.license_number,
            vendor.license_expiry,
            vendor.primary_contact,
            vendor.accounts_payable_contact,
            vendor.accounts_payable_email,
            vendor.rating,
            vendor.status || 'active',
            vendor.notes,
            userId,
            userId,
          ]
        );
        insertedVendors.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return insertedVendors;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = Vendors;
