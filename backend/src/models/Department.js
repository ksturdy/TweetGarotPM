const db = require('../config/database');

class Department {
  static async getAll(tenantId) {
    const result = await db.query(`
      SELECT d.*,
             e.first_name || ' ' || e.last_name as manager_name,
             (SELECT COUNT(*) FROM employees WHERE department_id = d.id AND employment_status = 'active') as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.manager_id = e.id
      WHERE d.tenant_id = $1
      ORDER BY d.name
    `, [tenantId]);
    return result.rows;
  }

  static async getById(id) {
    const result = await db.query(`
      SELECT d.*,
             e.first_name || ' ' || e.last_name as manager_name,
             (SELECT COUNT(*) FROM employees WHERE department_id = d.id AND employment_status = 'active') as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.manager_id = e.id
      WHERE d.id = $1
    `, [id]);
    return result.rows[0];
  }

  static async getByIdAndTenant(id, tenantId) {
    const result = await db.query(`
      SELECT d.*,
             e.first_name || ' ' || e.last_name as manager_name,
             (SELECT COUNT(*) FROM employees WHERE department_id = d.id AND employment_status = 'active') as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.manager_id = e.id
      WHERE d.id = $1 AND d.tenant_id = $2
    `, [id, tenantId]);
    return result.rows[0];
  }

  static async create(data, tenantId) {
    const { name, description, manager_id, department_number } = data;
    const result = await db.query(`
      INSERT INTO departments (name, description, manager_id, department_number, tenant_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, description, manager_id || null, department_number || null, tenantId]);
    return result.rows[0];
  }

  static async update(id, data, tenantId) {
    const { name, description, manager_id, department_number } = data;
    const result = await db.query(`
      UPDATE departments
      SET name = $1, description = $2, manager_id = $3, department_number = $4
      WHERE id = $5 AND tenant_id = $6
      RETURNING *
    `, [name, description, manager_id || null, department_number || null, id, tenantId]);
    return result.rows[0];
  }

  static async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM departments WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    return result.rows.length > 0;
  }

  static async getEmployeeCount(id, tenantId) {
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM employees
      WHERE department_id = $1 AND tenant_id = $2 AND employment_status = 'active'
    `, [id, tenantId]);
    return parseInt(result.rows[0].count);
  }
}

module.exports = Department;
