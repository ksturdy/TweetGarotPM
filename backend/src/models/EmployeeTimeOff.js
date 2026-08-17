const db = require('../config/database');

const EmployeeTimeOff = {
  async findByEmployee(employeeId, tenantId) {
    const result = await db.query(
      `SELECT eto.*, e.first_name, e.last_name
       FROM employee_time_off eto
       JOIN employees e ON e.id = eto.employee_id
       WHERE eto.employee_id = $1 AND eto.tenant_id = $2
       ORDER BY eto.start_date DESC`,
      [employeeId, tenantId]
    );
    return result.rows;
  },

  async findByDateRange(tenantId, fromDate, toDate) {
    const result = await db.query(
      `SELECT eto.*,
              e.first_name, e.last_name,
              e.trade  AS employee_trade,
              e.employee_group,
              e.title  AS employee_title
       FROM employee_time_off eto
       JOIN employees e ON e.id = eto.employee_id
       WHERE eto.tenant_id = $1
         AND eto.start_date <= $3::date
         AND eto.end_date   >= $2::date
       ORDER BY eto.start_date, e.last_name`,
      [tenantId, fromDate, toDate]
    );
    return result.rows;
  },

  async create(payload, tenantId, createdBy) {
    const { employeeId, type, startDate, endDate, notes } = payload;
    const result = await db.query(
      `INSERT INTO employee_time_off
         (tenant_id, employee_id, type, start_date, end_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, employeeId, type, startDate, endDate, notes || null, createdBy]
    );
    return result.rows[0];
  },

  async updateById(id, tenantId, patch) {
    const allowed = ['type', 'start_date', 'end_date', 'notes'];
    const sets = ['updated_at = CURRENT_TIMESTAMP'];
    const params = [];
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        params.push(patch[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    params.push(id, tenantId);
    const result = await db.query(
      `UPDATE employee_time_off
       SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
       RETURNING *`,
      params
    );
    return result.rows[0];
  },

  async deleteById(id, tenantId) {
    const result = await db.query(
      `DELETE FROM employee_time_off WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },
};

module.exports = EmployeeTimeOff;
