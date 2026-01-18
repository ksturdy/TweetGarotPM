const db = require('../config/database');

class OfficeLocation {
  static async getAll() {
    const result = await db.query(`
      SELECT ol.*,
             (SELECT COUNT(*) FROM employees WHERE office_location_id = ol.id AND employment_status = 'active') as employee_count
      FROM office_locations ol
      ORDER BY ol.name
    `);
    return result.rows;
  }

  static async getById(id) {
    const result = await db.query(`
      SELECT ol.*,
             (SELECT COUNT(*) FROM employees WHERE office_location_id = ol.id AND employment_status = 'active') as employee_count
      FROM office_locations ol
      WHERE ol.id = $1
    `, [id]);
    return result.rows[0];
  }

  static async create(data) {
    const { name, address, city, state, zip_code, phone } = data;
    const result = await db.query(`
      INSERT INTO office_locations (name, address, city, state, zip_code, phone)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, address, city, state, zip_code, phone]);
    return result.rows[0];
  }

  static async update(id, data) {
    const { name, address, city, state, zip_code, phone } = data;
    const result = await db.query(`
      UPDATE office_locations
      SET name = $1, address = $2, city = $3, state = $4, zip_code = $5, phone = $6
      WHERE id = $7
      RETURNING *
    `, [name, address, city, state, zip_code, phone, id]);
    return result.rows[0];
  }

  static async delete(id) {
    await db.query('DELETE FROM office_locations WHERE id = $1', [id]);
  }

  static async getEmployeeCount(id) {
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM employees
      WHERE office_location_id = $1 AND employment_status = 'active'
    `, [id]);
    return parseInt(result.rows[0].count);
  }
}

module.exports = OfficeLocation;
