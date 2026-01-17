const db = require('../config/database');

const Company = {
  async create({ name, address, city, state, zip, phone, email, website, notes }) {
    const result = await db.query(
      `INSERT INTO companies (name, address, city, state, zip, phone, email, website, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, address, city, state, zip, phone, email, website, notes]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      'SELECT * FROM companies WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await db.query(
      'SELECT * FROM companies ORDER BY name ASC'
    );
    return result.rows;
  },

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

  async update(id, updates) {
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
    const result = await db.query(
      `UPDATE companies SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM companies WHERE id = $1', [id]);
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
