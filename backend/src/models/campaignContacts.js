const db = require('../config/database');

const campaignContacts = {
  // Get all contacts for a campaign company
  getByCompanyId: async (campaignCompanyId) => {
    const query = `
      SELECT * FROM campaign_contacts
      WHERE campaign_company_id = $1
      ORDER BY is_primary DESC, name
    `;
    const result = await db.query(query, [campaignCompanyId]);
    return result.rows;
  },

  // Get contact by ID
  getById: async (id) => {
    const query = 'SELECT * FROM campaign_contacts WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0];
  },

  // Create contact
  create: async (data) => {
    const query = `
      INSERT INTO campaign_contacts (
        campaign_company_id, name, title, email, phone, is_primary, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      data.campaign_company_id,
      data.name,
      data.title || null,
      data.email || null,
      data.phone || null,
      data.is_primary || false,
      data.notes || null
    ];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Update contact
  update: async (id, data) => {
    const query = `
      UPDATE campaign_contacts
      SET name = COALESCE($1, name),
          title = COALESCE($2, title),
          email = COALESCE($3, email),
          phone = COALESCE($4, phone),
          is_primary = COALESCE($5, is_primary),
          notes = COALESCE($6, notes)
      WHERE id = $7
      RETURNING *
    `;
    const values = [data.name, data.title, data.email, data.phone, data.is_primary, data.notes, id];
    const result = await db.query(query, values);
    return result.rows[0];
  },

  // Delete contact
  delete: async (id) => {
    const query = 'DELETE FROM campaign_contacts WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    return result.rows[0];
  }
};

module.exports = campaignContacts;
