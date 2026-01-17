const db = require('../config/database');

const Contact = {
  async create({ companyId, firstName, lastName, title, email, phone, mobile, isPrimary, notes }) {
    const result = await db.query(
      `INSERT INTO contacts (company_id, first_name, last_name, title, email, phone, mobile, is_primary, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [companyId, firstName, lastName, title, email, phone, mobile, isPrimary || false, notes]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT c.*, comp.name as company_name
       FROM contacts c
       JOIN companies comp ON c.company_id = comp.id
       WHERE c.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByCompany(companyId) {
    const result = await db.query(
      `SELECT c.*, comp.name as company_name
       FROM contacts c
       JOIN companies comp ON c.company_id = comp.id
       WHERE c.company_id = $1
       ORDER BY c.is_primary DESC, c.last_name ASC, c.first_name ASC`,
      [companyId]
    );
    return result.rows;
  },

  async findByProject(projectId) {
    const result = await db.query(
      `SELECT c.*, comp.name as company_name, pc.role as company_role
       FROM contacts c
       JOIN companies comp ON c.company_id = comp.id
       JOIN project_companies pc ON comp.id = pc.company_id
       WHERE pc.project_id = $1
       ORDER BY comp.name ASC, c.is_primary DESC, c.last_name ASC, c.first_name ASC`,
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
      `UPDATE contacts SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM contacts WHERE id = $1', [id]);
  },
};

module.exports = Contact;
