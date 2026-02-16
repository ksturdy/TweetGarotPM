const db = require('../config/database');

const DailyTradeActuals = {
  async create(data) {
    const {
      weeklyGoalPlanId, tenantId, workDate, trade,
      actualCrewSize = 0, actualHoursWorked = 0,
      notes, createdBy
    } = data;

    const result = await db.query(
      `INSERT INTO daily_trade_actuals (
        weekly_goal_plan_id, tenant_id, work_date, trade,
        actual_crew_size, actual_hours_worked, notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (weekly_goal_plan_id, work_date, trade)
      DO UPDATE SET
        actual_crew_size = EXCLUDED.actual_crew_size,
        actual_hours_worked = EXCLUDED.actual_hours_worked,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *`,
      [weeklyGoalPlanId, tenantId, workDate, trade, actualCrewSize, actualHoursWorked, notes, createdBy]
    );
    return result.rows[0];
  },

  async findByPlanAndDate(weeklyGoalPlanId, workDate) {
    const result = await db.query(
      `SELECT * FROM daily_trade_actuals
       WHERE weekly_goal_plan_id = $1 AND work_date = $2
       ORDER BY trade`,
      [weeklyGoalPlanId, workDate]
    );
    return result.rows;
  },

  async findByPlan(weeklyGoalPlanId) {
    const result = await db.query(
      `SELECT * FROM daily_trade_actuals
       WHERE weekly_goal_plan_id = $1
       ORDER BY work_date, trade`,
      [weeklyGoalPlanId]
    );
    return result.rows;
  },

  async findByPlanAndTenant(weeklyGoalPlanId, tenantId) {
    const result = await db.query(
      `SELECT * FROM daily_trade_actuals
       WHERE weekly_goal_plan_id = $1 AND tenant_id = $2
       ORDER BY work_date, trade`,
      [weeklyGoalPlanId, tenantId]
    );
    return result.rows;
  },

  async update(weeklyGoalPlanId, workDate, trade, data) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (data.actualCrewSize !== undefined) {
      fields.push(`actual_crew_size = $${paramCount}`);
      values.push(data.actualCrewSize);
      paramCount++;
    }

    if (data.actualHoursWorked !== undefined) {
      fields.push(`actual_hours_worked = $${paramCount}`);
      values.push(data.actualHoursWorked);
      paramCount++;
    }

    if (data.notes !== undefined) {
      fields.push(`notes = $${paramCount}`);
      values.push(data.notes);
      paramCount++;
    }

    if (fields.length === 0) {
      return this.findByPlanAndDate(weeklyGoalPlanId, workDate);
    }

    values.push(weeklyGoalPlanId, workDate, trade);
    const result = await db.query(
      `UPDATE daily_trade_actuals
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE weekly_goal_plan_id = $${paramCount} AND work_date = $${paramCount + 1} AND trade = $${paramCount + 2}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async delete(weeklyGoalPlanId, workDate, trade) {
    await db.query(
      'DELETE FROM daily_trade_actuals WHERE weekly_goal_plan_id = $1 AND work_date = $2 AND trade = $3',
      [weeklyGoalPlanId, workDate, trade]
    );
  },
};

module.exports = DailyTradeActuals;
