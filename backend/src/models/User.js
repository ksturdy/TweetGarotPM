const db = require('../config/database');
const bcrypt = require('bcryptjs');

const User = {
  async create({ email, password, firstName, lastName, role = 'user' }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (email, password, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email, hashedPassword, firstName, lastName, role]
    );
    return result.rows[0];
  },

  async findByEmail(email) {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async findAll() {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, role, created_at FROM users ORDER BY last_name, first_name'
    );
    return result.rows;
  },

  async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  },
};

module.exports = User;
