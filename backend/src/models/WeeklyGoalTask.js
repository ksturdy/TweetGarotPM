const db = require('../config/database');
const WeeklyGoalPlan = require('./WeeklyGoalPlan');

const WeeklyGoalTask = {
  async create(data) {
    const {
      weeklyGoalPlanId, tenantId, trade, taskDate, description,
      quantity, unit, status = 'incomplete', incompleteReason, incompleteNotes,
      actualHours = 0, sortOrder = 0, createdBy
    } = data;

    // Validate task_date is within week boundaries
    const plan = await db.query(
      'SELECT week_start_date, week_end_date FROM weekly_goal_plans WHERE id = $1',
      [weeklyGoalPlanId]
    );

    if (plan.rows.length === 0) {
      throw new Error('Weekly goal plan not found');
    }

    const { week_start_date, week_end_date } = plan.rows[0];
    const taskDateObj = new Date(taskDate);
    const startDateObj = new Date(week_start_date);
    const endDateObj = new Date(week_end_date);

    if (taskDateObj < startDateObj || taskDateObj > endDateObj) {
      throw new Error(`Task date must be between ${week_start_date} and ${week_end_date}`);
    }

    const result = await db.query(
      `INSERT INTO weekly_goal_tasks (
        weekly_goal_plan_id, tenant_id, trade, task_date, description,
        quantity, unit, status, incomplete_reason, incomplete_notes,
        actual_hours, sort_order, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        weeklyGoalPlanId, tenantId, trade, taskDate, description,
        quantity, unit, status, incompleteReason, incompleteNotes,
        actualHours, sortOrder, createdBy
      ]
    );

    // Update parent plan's actual hours for this trade
    await WeeklyGoalPlan.updateActualHours(weeklyGoalPlanId, trade);

    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT wgt.*,
              wgp.week_start_date, wgp.week_end_date, wgp.project_id,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM weekly_goal_tasks wgt
       JOIN weekly_goal_plans wgp ON wgt.weekly_goal_plan_id = wgp.id
       LEFT JOIN users u ON wgt.created_by = u.id
       WHERE wgt.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      `SELECT wgt.*,
              wgp.week_start_date, wgp.week_end_date, wgp.project_id,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM weekly_goal_tasks wgt
       JOIN weekly_goal_plans wgp ON wgt.weekly_goal_plan_id = wgp.id
       LEFT JOIN users u ON wgt.created_by = u.id
       WHERE wgt.id = $1 AND wgt.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async findByWeeklyPlan(weeklyGoalPlanId, filters = {}) {
    let query = `
      SELECT wgt.*,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM weekly_goal_tasks wgt
      LEFT JOIN users u ON wgt.created_by = u.id
      WHERE wgt.weekly_goal_plan_id = $1
    `;
    const params = [weeklyGoalPlanId];

    if (filters.trade) {
      params.push(filters.trade);
      query += ` AND wgt.trade = $${params.length}`;
    }

    if (filters.date) {
      params.push(filters.date);
      query += ` AND wgt.task_date = $${params.length}`;
    }

    if (filters.status) {
      params.push(filters.status);
      query += ` AND wgt.status = $${params.length}`;
    }

    query += ' ORDER BY wgt.task_date, wgt.sort_order';

    const result = await db.query(query, params);
    return result.rows;
  },

  async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Track if actual_hours changed
    const actualHoursChanged = updates.actualHours !== undefined;

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbField} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await db.query(
      `UPDATE weekly_goal_tasks SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    const task = result.rows[0];

    // Update parent plan's actual hours if actual_hours changed
    if (actualHoursChanged && task) {
      await WeeklyGoalPlan.updateActualHours(task.weekly_goal_plan_id, task.trade);
    }

    return task;
  },

  async updateStatus(id, status, incompleteReason = null, incompleteNotes = null) {
    const result = await db.query(
      `UPDATE weekly_goal_tasks
       SET status = $1, incomplete_reason = $2, incomplete_notes = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, incompleteReason, incompleteNotes, id]
    );
    return result.rows[0];
  },

  async moveTask(id, direction) {
    const task = await this.findById(id);
    if (!task) {
      throw new Error('Task not found');
    }

    let newDate;
    let newPlanId = task.weekly_goal_plan_id;
    const oldPlanId = task.weekly_goal_plan_id;
    const oldTrade = task.trade;

    if (direction === 'earlier') {
      // Move to previous day
      const taskDate = new Date(task.task_date);
      taskDate.setDate(taskDate.getDate() - 1);
      newDate = taskDate.toISOString().split('T')[0];

      // Check if still within week boundaries
      if (taskDate < new Date(task.week_start_date)) {
        throw new Error('Cannot move task earlier - already at start of week');
      }
    } else if (direction === 'later') {
      // Move to next day
      const taskDate = new Date(task.task_date);
      taskDate.setDate(taskDate.getDate() + 1);
      newDate = taskDate.toISOString().split('T')[0];

      // Check if still within week boundaries
      if (taskDate > new Date(task.week_end_date)) {
        throw new Error('Cannot move task later - already at end of week');
      }
    } else if (direction === 'next-week') {
      // Move to same day next week
      const taskDate = new Date(task.task_date);
      taskDate.setDate(taskDate.getDate() + 7);
      newDate = taskDate.toISOString().split('T')[0];

      // Calculate next week's start date
      const nextWeekStart = new Date(task.week_start_date);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      const nextWeekStartStr = nextWeekStart.toISOString().split('T')[0];

      // Find or create next week's plan
      const nextPlan = await WeeklyGoalPlan.findByProjectAndWeek(task.project_id, nextWeekStartStr);

      if (nextPlan) {
        newPlanId = nextPlan.id;
      } else {
        // Create next week's plan
        const nextWeekEnd = new Date(task.week_end_date);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
        const nextWeekEndStr = nextWeekEnd.toISOString().split('T')[0];

        const currentPlan = await db.query(
          'SELECT * FROM weekly_goal_plans WHERE id = $1',
          [task.weekly_goal_plan_id]
        );

        const plan = currentPlan.rows[0];

        const newPlan = await WeeklyGoalPlan.create({
          projectId: task.project_id,
          tenantId: task.tenant_id,
          weekStartDate: nextWeekStartStr,
          weekEndDate: nextWeekEndStr,
          includeSunday: plan.include_sunday,
          plumbingForeman: plan.plumbing_foreman,
          plumbingCrewSize: plan.plumbing_crew_size,
          plumbingHoursPerDay: plan.plumbing_hours_per_day,
          plumbingDaysWorked: plan.plumbing_days_worked,
          pipingForeman: plan.piping_foreman,
          pipingCrewSize: plan.piping_crew_size,
          pipingHoursPerDay: plan.piping_hours_per_day,
          pipingDaysWorked: plan.piping_days_worked,
          sheetMetalForeman: plan.sheet_metal_foreman,
          sheetMetalCrewSize: plan.sheet_metal_crew_size,
          sheetMetalHoursPerDay: plan.sheet_metal_hours_per_day,
          sheetMetalDaysWorked: plan.sheet_metal_days_worked,
          createdBy: task.created_by
        });

        newPlanId = newPlan.id;
      }

      // Reset status to incomplete when moving to next week
      await db.query(
        `UPDATE weekly_goal_tasks
         SET weekly_goal_plan_id = $1, task_date = $2, status = 'incomplete',
             incomplete_reason = NULL, incomplete_notes = NULL, updated_at = NOW()
         WHERE id = $3`,
        [newPlanId, newDate, id]
      );

      // Update both old and new plan's actual hours
      await WeeklyGoalPlan.updateActualHours(oldPlanId, oldTrade);
      await WeeklyGoalPlan.updateActualHours(newPlanId, oldTrade);

      return this.findById(id);
    } else {
      throw new Error('Invalid direction. Use "earlier", "later", or "next-week"');
    }

    // Update task date for earlier/later
    const result = await db.query(
      `UPDATE weekly_goal_tasks
       SET task_date = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newDate, id]
    );

    return result.rows[0];
  },

  async reorder(weeklyGoalPlanId, taskId, newSortOrder) {
    const result = await db.query(
      `UPDATE weekly_goal_tasks
       SET sort_order = $1, updated_at = NOW()
       WHERE id = $2 AND weekly_goal_plan_id = $3
       RETURNING *`,
      [newSortOrder, taskId, weeklyGoalPlanId]
    );
    return result.rows[0];
  },

  async delete(id) {
    const task = await this.findById(id);
    if (!task) return;

    await db.query('DELETE FROM weekly_goal_tasks WHERE id = $1', [id]);

    // Update parent plan's actual hours
    await WeeklyGoalPlan.updateActualHours(task.weekly_goal_plan_id, task.trade);
  },
};

module.exports = WeeklyGoalTask;
