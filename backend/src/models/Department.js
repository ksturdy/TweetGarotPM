const db = require('../config/database');

class Department {
  static async getAll() {
    const result = await db.query(`
      SELECT d.*,
             e.first_name || ' ' || e.last_name as manager_name,
             (SELECT COUNT(*) FROM employees WHERE department_id = d.id AND employment_status = 'active') as employee_count
      FROM departments d
      LEFT JOIN employees e ON d.manager_id = e.id
      ORDER BY d.name
    `);
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

  static async create(data) {
    const { name, description, manager_id, department_number } = data;
    const result = await db.query(`
      INSERT INTO departments (name, description, manager_id, department_number)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, description, manager_id || null, department_number || null]);
    return result.rows[0];
  }

  static async update(id, data) {
    const { name, description, manager_id, department_number } = data;
    const result = await db.query(`
      UPDATE departments
      SET name = $1, description = $2, manager_id = $3, department_number = $4
      WHERE id = $5
      RETURNING *
    `, [name, description, manager_id || null, department_number || null, id]);
    return result.rows[0];
  }

  static async delete(id) {
    await db.query('DELETE FROM departments WHERE id = $1', [id]);
  }

  static async getEmployeeCount(id) {
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM employees
      WHERE department_id = $1 AND employment_status = 'active'
    `, [id]);
    return parseInt(result.rows[0].count);
  }
}

module.exports = Department;
