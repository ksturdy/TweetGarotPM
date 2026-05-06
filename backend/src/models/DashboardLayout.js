const pool = require('../config/database');

const DashboardLayout = {
  async getByUserId(userId) {
    const result = await pool.query(
      'SELECT layout_json, updated_at FROM user_dashboard_layouts WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  },

  async upsert(userId, layoutJson) {
    const result = await pool.query(
      `INSERT INTO user_dashboard_layouts (user_id, layout_json, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE
         SET layout_json = EXCLUDED.layout_json,
             updated_at = CURRENT_TIMESTAMP
       RETURNING layout_json, updated_at`,
      [userId, JSON.stringify(layoutJson)]
    );
    return result.rows[0];
  },

  async remove(userId) {
    await pool.query(
      'DELETE FROM user_dashboard_layouts WHERE user_id = $1',
      [userId]
    );
  },
};

module.exports = DashboardLayout;
