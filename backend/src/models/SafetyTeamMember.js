const db = require('../config/database');

const SafetyTeamMember = {
  async getAll(tenantId) {
    const result = await db.query(
      `SELECT stm.id, stm.user_id, stm.color, stm.created_at,
              u.first_name, u.last_name, u.email,
              u.first_name || ' ' || u.last_name AS full_name
         FROM safety_team_members stm
         JOIN users u ON u.id = stm.user_id
        WHERE stm.tenant_id = $1
        ORDER BY u.last_name, u.first_name`,
      [tenantId]
    );
    return result.rows;
  },

  async add(tenantId, userId, createdBy) {
    const result = await db.query(
      `INSERT INTO safety_team_members (tenant_id, user_id, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, user_id) DO NOTHING
       RETURNING id`,
      [tenantId, userId, createdBy]
    );
    if (!result.rows[0]) return this.getByUserId(tenantId, userId);
    return this.getByUserId(tenantId, userId);
  },

  async getByUserId(tenantId, userId) {
    const result = await db.query(
      `SELECT stm.id, stm.user_id, stm.color, stm.created_at,
              u.first_name, u.last_name, u.email,
              u.first_name || ' ' || u.last_name AS full_name
         FROM safety_team_members stm
         JOIN users u ON u.id = stm.user_id
        WHERE stm.tenant_id = $1 AND stm.user_id = $2`,
      [tenantId, userId]
    );
    return result.rows[0] || null;
  },

  async updateColor(tenantId, userId, color) {
    await db.query(
      `UPDATE safety_team_members SET color = $1 WHERE tenant_id = $2 AND user_id = $3`,
      [color, tenantId, userId]
    );
    return this.getByUserId(tenantId, userId);
  },

  async remove(tenantId, userId) {
    await db.query(
      `DELETE FROM safety_team_members WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId]
    );
  },
};

module.exports = SafetyTeamMember;
