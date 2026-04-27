const db = require('../config/database');

const ProjectGoal = {
  async getByProject(projectId, tenantId) {
    const result = await db.query(
      `SELECT * FROM project_goals WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, tenantId]
    );
    return result.rows[0] || null;
  },

  async upsert(projectId, tenantId, data, userId) {
    const result = await db.query(
      `INSERT INTO project_goals (
        project_id, tenant_id,
        cash_flow_goal_pct, margin_goal_pct, shop_hours_goal_pct, labor_rate_goal,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      ON CONFLICT (project_id) DO UPDATE SET
        cash_flow_goal_pct = EXCLUDED.cash_flow_goal_pct,
        margin_goal_pct = EXCLUDED.margin_goal_pct,
        shop_hours_goal_pct = EXCLUDED.shop_hours_goal_pct,
        labor_rate_goal = EXCLUDED.labor_rate_goal,
        updated_by = $7,
        updated_at = NOW()
      RETURNING *`,
      [
        projectId, tenantId,
        data.cash_flow_goal_pct ?? null,
        data.margin_goal_pct ?? null,
        data.shop_hours_goal_pct ?? null,
        data.labor_rate_goal ?? null,
        userId
      ]
    );
    return result.rows[0];
  },

  async delete(projectId, tenantId) {
    const result = await db.query(
      `DELETE FROM project_goals WHERE project_id = $1 AND tenant_id = $2 RETURNING *`,
      [projectId, tenantId]
    );
    return result.rows[0];
  },
};

module.exports = ProjectGoal;
