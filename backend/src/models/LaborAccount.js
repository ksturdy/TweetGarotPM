const db = require('../config/database');

const LaborAccount = {
  async findAll(tenantId, includeInactive = false) {
    const result = await db.query(
      `SELECT la.*, c.name as customer_name
       FROM labor_accounts la
       LEFT JOIN customers c ON c.id = la.customer_id
       WHERE la.tenant_id = $1
         ${includeInactive ? '' : 'AND la.is_active = TRUE'}
       ORDER BY la.department_code NULLS LAST, la.name`,
      [tenantId]
    );
    return result.rows;
  },

  async findById(id, tenantId) {
    const result = await db.query(
      `SELECT la.*, c.name as customer_name
       FROM labor_accounts la
       LEFT JOIN customers c ON c.id = la.customer_id
       WHERE la.id = $1 AND la.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async create(payload, tenantId, createdBy) {
    const { name, departmentCode, location, customerId, notes } = payload;
    const result = await db.query(
      `INSERT INTO labor_accounts (tenant_id, name, department_code, location, customer_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, name, departmentCode || null, location || null, customerId || null, notes || null, createdBy]
    );
    return result.rows[0];
  },

  async updateById(id, tenantId, patch) {
    const allowed = ['name', 'department_code', 'location', 'customer_id', 'is_active', 'notes'];
    const sets = ['updated_at = CURRENT_TIMESTAMP'];
    const params = [];
    for (const key of allowed) {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const val = patch[key] !== undefined ? patch[key] : patch[camelKey];
      if (val !== undefined) {
        params.push(val);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (params.length === 0) return this.findById(id, tenantId);
    params.push(id, tenantId);
    const result = await db.query(
      `UPDATE labor_accounts SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
       RETURNING *`,
      params
    );
    return result.rows[0];
  },

  async deleteById(id, tenantId) {
    const result = await db.query(
      `DELETE FROM labor_accounts WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },
};

module.exports = LaborAccount;
