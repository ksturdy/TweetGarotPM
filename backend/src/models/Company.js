const db = require('../config/database');

const Company = {
  /**
   * Create a new company
   */
  async create({ name, address, city, state, zip, phone, email, website, notes }, tenantId) {
    const result = await db.query(
      `INSERT INTO companies (name, address, city, state, zip, phone, email, website, notes, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [name, address, city, state, zip, phone, email, website, notes, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Find company by ID (global)
   */
  async findById(id) {
    const result = await db.query(
      'SELECT * FROM companies WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  /**
   * Find company by ID with tenant check
   */
  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      'SELECT * FROM companies WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Find all companies (global)
   */
  async findAll() {
    const result = await db.query(
      'SELECT * FROM companies ORDER BY name ASC'
    );
    return result.rows;
  },

  /**
   * Find all companies within a tenant
   */
  async findAllByTenant(tenantId) {
    const result = await db.query(
      'SELECT * FROM companies WHERE tenant_id = $1 ORDER BY name ASC',
      [tenantId]
    );
    return result.rows;
  },

  /**
   * Count companies in a tenant
   */
  async countByTenant(tenantId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM companies WHERE tenant_id = $1',
      [tenantId]
    );
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Find companies by project (with tenant check via project)
   */
  async findByProject(projectId) {
    const result = await db.query(
      `SELECT c.*, pc.role, pc.is_primary, pc.notes as project_notes, pc.id as project_company_id
       FROM companies c
       JOIN project_companies pc ON c.id = pc.company_id
       WHERE pc.project_id = $1
       ORDER BY c.name ASC`,
      [projectId]
    );
    return result.rows;
  },

  /**
   * Update company with tenant check
   */
  async update(id, updates, tenantId) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbField} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    values.push(id);
    values.push(tenantId);

    const result = await db.query(
      `UPDATE companies SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  /**
   * Delete company with tenant check
   */
  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM companies WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    return result.rows.length > 0;
  },

  // Project-Company association methods
  async addToProject({ projectId, companyId, role, isPrimary, notes }) {
    const result = await db.query(
      `INSERT INTO project_companies (project_id, company_id, role, is_primary, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, companyId, role, isPrimary || false, notes]
    );
    return result.rows[0];
  },

  async updateProjectCompany(projectCompanyId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbField} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    values.push(projectCompanyId);
    const result = await db.query(
      `UPDATE project_companies SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async removeFromProject(projectCompanyId) {
    await db.query('DELETE FROM project_companies WHERE id = $1', [projectCompanyId]);
  },
};

module.exports = Company;
