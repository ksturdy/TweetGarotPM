const db = require('../config/database');
const bcrypt = require('bcryptjs');

const User = {
  async create({ email, password, firstName, lastName, role = 'user', hrAccess = 'none' }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (email, password, first_name, last_name, role, hr_access)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, hr_access, created_at`,
      [email, hashedPassword, firstName, lastName, role, hrAccess]
    );
    return result.rows[0];
  },

  async findByEmail(email) {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, role, hr_access, is_active, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, role, hr_access, is_active, created_at FROM users ORDER BY last_name, first_name'
    );
    return result.rows;
  },

  async update(id, { email, firstName, lastName, role, hrAccess, isActive }) {
    const result = await db.query(
      `UPDATE users
       SET email = $1, first_name = $2, last_name = $3, role = $4, hr_access = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id, email, first_name, last_name, role, hr_access, is_active, created_at`,
      [email, firstName, lastName, role, hrAccess, isActive, id]
    );
    return result.rows[0];
  },

  async updateStatus(id, isActive) {
    const result = await db.query(
      `UPDATE users
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, first_name, last_name, role, hr_access, is_active, created_at`,
      [isActive, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
  },

  async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  },
};

module.exports = User;
