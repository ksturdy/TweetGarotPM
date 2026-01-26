const db = require('../config/database');

class OfficeLocation {
  static async getAll(tenantId) {
    const result = await db.query(`
      SELECT ol.*,
             (SELECT COUNT(*) FROM employees WHERE office_location_id = ol.id AND employment_status = 'active') as employee_count
      FROM office_locations ol
      WHERE ol.tenant_id = $1
      ORDER BY ol.name
    `, [tenantId]);
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

  static async getByIdAndTenant(id, tenantId) {
    const result = await db.query(`
      SELECT ol.*,
             (SELECT COUNT(*) FROM employees WHERE office_location_id = ol.id AND employment_status = 'active') as employee_count
      FROM office_locations ol
      WHERE ol.id = $1 AND ol.tenant_id = $2
    `, [id, tenantId]);
    return result.rows[0];
  }

  static async create(data, tenantId) {
    const { name, address, city, state, zip_code, phone } = data;
    const result = await db.query(`
      INSERT INTO office_locations (name, address, city, state, zip_code, phone, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, address, city, state, zip_code, phone, tenantId]);
    return result.rows[0];
  }

  static async update(id, data, tenantId) {
    const { name, address, city, state, zip_code, phone } = data;
    const result = await db.query(`
      UPDATE office_locations
      SET name = $1, address = $2, city = $3, state = $4, zip_code = $5, phone = $6
      WHERE id = $7 AND tenant_id = $8
      RETURNING *
    `, [name, address, city, state, zip_code, phone, id, tenantId]);
    return result.rows[0];
  }

  static async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM office_locations WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    return result.rows.length > 0;
  }

  static async getEmployeeCount(id, tenantId) {
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM employees
      WHERE office_location_id = $1 AND tenant_id = $2 AND employment_status = 'active'
    `, [id, tenantId]);
    return parseInt(result.rows[0].count);
  }
}

module.exports = OfficeLocation;
