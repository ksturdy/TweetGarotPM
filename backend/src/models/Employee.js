const db = require('../config/database');

class Employee {
  static async getAll(filters = {}) {
    let query = `
      SELECT e.*,
             d.name as department_name,
             ol.name as office_location_name,
             u.email as user_email
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN office_locations ol ON e.office_location_id = ol.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.department_id) {
      params.push(filters.department_id);
      query += ` AND e.department_id = $${params.length}`;
    }

    if (filters.office_location_id) {
      params.push(filters.office_location_id);
      query += ` AND e.office_location_id = $${params.length}`;
    }

    if (filters.employment_status) {
      params.push(filters.employment_status);
      query += ` AND e.employment_status = $${params.length}`;
    } else {
      // Default to active employees only
      query += ` AND e.employment_status = 'active'`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      query += ` AND (e.first_name ILIKE $${params.length} OR e.last_name ILIKE $${params.length} OR e.email ILIKE $${params.length})`;
    }

    query += ` ORDER BY e.last_name, e.first_name`;

    const result = await db.query(query, params);
    return result.rows;
  }

  static async getById(id) {
    const result = await db.query(`
      SELECT e.*,
             d.name as department_name,
             ol.name as office_location_name,
             ol.address as office_address,
             ol.city as office_city,
             ol.state as office_state,
             ol.zip_code as office_zip,
             ol.phone as office_phone,
             u.email as user_email,
             u.role as user_role
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN office_locations ol ON e.office_location_id = ol.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = $1
    `, [id]);
    return result.rows[0];
  }

  static async create(data) {
    const {
      user_id,
      first_name,
      last_name,
      email,
      phone,
      mobile_phone,
      department_id,
      office_location_id,
      job_title,
      hire_date,
      employment_status,
      notes,
      role
    } = data;

    const result = await db.query(`
      INSERT INTO employees (
        user_id, first_name, last_name, email, phone, mobile_phone,
        department_id, office_location_id, job_title, hire_date,
        employment_status, notes, role
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      user_id || null,
      first_name,
      last_name,
      email,
      phone,
      mobile_phone,
      department_id || null,
      office_location_id || null,
      job_title,
      hire_date,
      employment_status || 'active',
      notes,
      role || 'user'
    ]);
    return result.rows[0];
  }

  static async update(id, data) {
    const {
      user_id,
      first_name,
      last_name,
      email,
      phone,
      mobile_phone,
      department_id,
      office_location_id,
      job_title,
      hire_date,
      employment_status,
      notes,
      role
    } = data;

    const result = await db.query(`
      UPDATE employees
      SET user_id = $1, first_name = $2, last_name = $3, email = $4,
          phone = $5, mobile_phone = $6, department_id = $7,
          office_location_id = $8, job_title = $9, hire_date = $10,
          employment_status = $11, notes = $12, role = $13
      WHERE id = $14
      RETURNING *
    `, [
      user_id || null,
      first_name,
      last_name,
      email,
      phone,
      mobile_phone,
      department_id || null,
      office_location_id || null,
      job_title,
      hire_date,
      employment_status,
      notes,
      role || 'user',
      id
    ]);
    return result.rows[0];
  }

  static async delete(id) {
    await db.query('DELETE FROM employees WHERE id = $1', [id]);
  }

  static async getByUserId(userId) {
    const result = await db.query(`
      SELECT e.*,
             d.name as department_name,
             ol.name as office_location_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN office_locations ol ON e.office_location_id = ol.id
      WHERE e.user_id = $1
    `, [userId]);
    return result.rows[0];
  }
}

module.exports = Employee;
