const db = require('../config/database');

const FieldFavoriteVendor = {
  async findAll(userId) {
    const result = await db.query(
      `SELECT * FROM field_favorite_vendors
       WHERE created_by = $1
       ORDER BY name`,
      [userId]
    );
    return result.rows;
  },

  async findById(id) {
    const result = await db.query(
      'SELECT * FROM field_favorite_vendors WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async create({ tenantId, name, location, phone, contactName, email, createdBy }) {
    const result = await db.query(
      `INSERT INTO field_favorite_vendors (tenant_id, name, location, phone, contact_name, email, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, name, location, phone, contactName, email, createdBy]
    );
    return result.rows[0];
  },

  async update(id, { name, location, phone, contactName, email }) {
    const result = await db.query(
      `UPDATE field_favorite_vendors
       SET name = $1, location = $2, phone = $3, contact_name = $4, email = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, location, phone, contactName, email, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM field_favorite_vendors WHERE id = $1', [id]);
  },
};

module.exports = FieldFavoriteVendor;
