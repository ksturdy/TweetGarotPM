const db = require('../config/database');

const WeeklyGoalPlan = {
  // Helper to calculate planned hours
  calculatePlannedHours(crewSize, hoursPerDay, daysWorked) {
    return (crewSize || 0) * (hoursPerDay || 0) * (daysWorked || 0);
  },

  async create(data) {
    const {
      projectId, tenantId, weekStartDate, weekEndDate, includeSunday = false,
      plumbingForeman, plumbingCrewSize = 0, plumbingHoursPerDay = 0, plumbingDaysWorked = 0,
      pipingForeman, pipingCrewSize = 0, pipingHoursPerDay = 0, pipingDaysWorked = 0,
      sheetMetalForeman, sheetMetalCrewSize = 0, sheetMetalHoursPerDay = 0, sheetMetalDaysWorked = 0,
      status = 'active', notes, createdBy
    } = data;

    // Calculate planned hours for each trade
    const plumbingPlannedHours = this.calculatePlannedHours(plumbingCrewSize, plumbingHoursPerDay, plumbingDaysWorked);
    const pipingPlannedHours = this.calculatePlannedHours(pipingCrewSize, pipingHoursPerDay, pipingDaysWorked);
    const sheetMetalPlannedHours = this.calculatePlannedHours(sheetMetalCrewSize, sheetMetalHoursPerDay, sheetMetalDaysWorked);

    const result = await db.query(
      `INSERT INTO weekly_goal_plans (
        project_id, tenant_id, week_start_date, week_end_date, include_sunday,
        plumbing_foreman, plumbing_crew_size, plumbing_hours_per_day, plumbing_days_worked, plumbing_planned_hours, plumbing_actual_hours,
        piping_foreman, piping_crew_size, piping_hours_per_day, piping_days_worked, piping_planned_hours, piping_actual_hours,
        sheet_metal_foreman, sheet_metal_crew_size, sheet_metal_hours_per_day, sheet_metal_days_worked, sheet_metal_planned_hours, sheet_metal_actual_hours,
        status, notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12, $13, $14, $15, 0, $16, $17, $18, $19, $20, 0, $21, $22, $23)
      RETURNING *`,
      [
        projectId, tenantId, weekStartDate, weekEndDate, includeSunday,
        plumbingForeman, plumbingCrewSize, plumbingHoursPerDay, plumbingDaysWorked, plumbingPlannedHours,
        pipingForeman, pipingCrewSize, pipingHoursPerDay, pipingDaysWorked, pipingPlannedHours,
        sheetMetalForeman, sheetMetalCrewSize, sheetMetalHoursPerDay, sheetMetalDaysWorked, sheetMetalPlannedHours,
        status, notes, createdBy
      ]
    );
    return result.rows[0];
  },

  async findById(id) {
    const result = await db.query(
      `SELECT wgp.*,
              p.name as project_name, p.number as project_number,
              u.first_name || ' ' || u.last_name as created_by_name,
              (SELECT COUNT(*) FROM weekly_goal_tasks WHERE weekly_goal_plan_id = wgp.id) as task_count
       FROM weekly_goal_plans wgp
       JOIN projects p ON wgp.project_id = p.id
       LEFT JOIN users u ON wgp.created_by = u.id
       WHERE wgp.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      `SELECT wgp.*,
              p.name as project_name, p.number as project_number,
              u.first_name || ' ' || u.last_name as created_by_name,
              (SELECT COUNT(*) FROM weekly_goal_tasks WHERE weekly_goal_plan_id = wgp.id) as task_count
       FROM weekly_goal_plans wgp
       JOIN projects p ON wgp.project_id = p.id
       LEFT JOIN users u ON wgp.created_by = u.id
       WHERE wgp.id = $1 AND wgp.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async findByProject(projectId, filters = {}) {
    let query = `
      SELECT wgp.*,
             u.first_name || ' ' || u.last_name as created_by_name,
             (SELECT COUNT(*) FROM weekly_goal_tasks WHERE weekly_goal_plan_id = wgp.id) as task_count
      FROM weekly_goal_plans wgp
      LEFT JOIN users u ON wgp.created_by = u.id
      WHERE wgp.project_id = $1
    `;
    const params = [projectId];

    if (filters.startDate) {
      params.push(filters.startDate);
      query += ` AND wgp.week_start_date >= $${params.length}`;
    }

    if (filters.endDate) {
      params.push(filters.endDate);
      query += ` AND wgp.week_end_date <= $${params.length}`;
    }

    if (filters.status) {
      params.push(filters.status);
      query += ` AND wgp.status = $${params.length}`;
    }

    query += ' ORDER BY wgp.week_start_date DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  async findByProjectAndWeek(projectId, weekStartDate) {
    const result = await db.query(
      `SELECT wgp.*,
              u.first_name || ' ' || u.last_name as created_by_name,
              (SELECT COUNT(*) FROM weekly_goal_tasks WHERE weekly_goal_plan_id = wgp.id) as task_count
       FROM weekly_goal_plans wgp
       LEFT JOIN users u ON wgp.created_by = u.id
       WHERE wgp.project_id = $1 AND wgp.week_start_date = $2`,
      [projectId, weekStartDate]
    );
    return result.rows[0];
  },

  async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Track if we need to recalculate planned hours
    const needsRecalc = {};
    const tradeFields = {
      plumbing: ['plumbingCrewSize', 'plumbingHoursPerDay', 'plumbingDaysWorked'],
      piping: ['pipingCrewSize', 'pipingHoursPerDay', 'pipingDaysWorked'],
      sheetMetal: ['sheetMetalCrewSize', 'sheetMetalHoursPerDay', 'sheetMetalDaysWorked']
    };

    // Check if we need to recalculate any trade's planned hours
    Object.keys(tradeFields).forEach(trade => {
      if (tradeFields[trade].some(field => updates[field] !== undefined)) {
        needsRecalc[trade] = true;
      }
    });

    // If recalculation is needed, fetch current values
    let currentPlan = null;
    if (Object.keys(needsRecalc).length > 0) {
      const currentResult = await db.query('SELECT * FROM weekly_goal_plans WHERE id = $1', [id]);
      currentPlan = currentResult.rows[0];
    }

    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();

        // Skip planned_hours fields if we're recalculating
        if (!dbField.endsWith('_planned_hours')) {
          fields.push(`${dbField} = $${paramCount}`);
          values.push(updates[key]);
          paramCount++;
        }
      }
    });

    // Recalculate and add planned hours if needed
    if (needsRecalc.plumbing && currentPlan) {
      const crewSize = updates.plumbingCrewSize !== undefined ? updates.plumbingCrewSize : currentPlan.plumbing_crew_size;
      const hoursPerDay = updates.plumbingHoursPerDay !== undefined ? updates.plumbingHoursPerDay : currentPlan.plumbing_hours_per_day;
      const daysWorked = updates.plumbingDaysWorked !== undefined ? updates.plumbingDaysWorked : currentPlan.plumbing_days_worked;
      const plannedHours = this.calculatePlannedHours(crewSize, hoursPerDay, daysWorked);
      fields.push(`plumbing_planned_hours = $${paramCount}`);
      values.push(plannedHours);
      paramCount++;
    }

    if (needsRecalc.piping && currentPlan) {
      const crewSize = updates.pipingCrewSize !== undefined ? updates.pipingCrewSize : currentPlan.piping_crew_size;
      const hoursPerDay = updates.pipingHoursPerDay !== undefined ? updates.pipingHoursPerDay : currentPlan.piping_hours_per_day;
      const daysWorked = updates.pipingDaysWorked !== undefined ? updates.pipingDaysWorked : currentPlan.piping_days_worked;
      const plannedHours = this.calculatePlannedHours(crewSize, hoursPerDay, daysWorked);
      fields.push(`piping_planned_hours = $${paramCount}`);
      values.push(plannedHours);
      paramCount++;
    }

    if (needsRecalc.sheetMetal && currentPlan) {
      const crewSize = updates.sheetMetalCrewSize !== undefined ? updates.sheetMetalCrewSize : currentPlan.sheet_metal_crew_size;
      const hoursPerDay = updates.sheetMetalHoursPerDay !== undefined ? updates.sheetMetalHoursPerDay : currentPlan.sheet_metal_hours_per_day;
      const daysWorked = updates.sheetMetalDaysWorked !== undefined ? updates.sheetMetalDaysWorked : currentPlan.sheet_metal_days_worked;
      const plannedHours = this.calculatePlannedHours(crewSize, hoursPerDay, daysWorked);
      fields.push(`sheet_metal_planned_hours = $${paramCount}`);
      values.push(plannedHours);
      paramCount++;
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await db.query(
      `UPDATE weekly_goal_plans SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async updateActualHours(id, trade) {
    // Aggregate actual hours from tasks for a specific trade
    const tradeColumn = `${trade}_actual_hours`;
    const result = await db.query(
      `UPDATE weekly_goal_plans
       SET ${tradeColumn} = (
         SELECT COALESCE(SUM(actual_hours), 0)
         FROM weekly_goal_tasks
         WHERE weekly_goal_plan_id = $1 AND trade = $2
       ),
       updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, trade]
    );
    return result.rows[0];
  },

  async getWeeklySummary(id) {
    const plan = await this.findById(id);
    if (!plan) return null;

    const calculateTradeSummary = (trade) => {
      const plannedHours = plan[`${trade}_planned_hours`] || 0;
      const actualHours = plan[`${trade}_actual_hours`] || 0;
      const variance = actualHours - plannedHours;
      const percentComplete = plannedHours > 0 ? Math.round((actualHours / plannedHours) * 100) : 0;

      return {
        planned_hours: Number(plannedHours),
        actual_hours: Number(actualHours),
        variance: Number(variance),
        percent_complete: percentComplete
      };
    };

    const plumbing = calculateTradeSummary('plumbing');
    const piping = calculateTradeSummary('piping');
    const sheetMetal = calculateTradeSummary('sheet_metal');

    const totalPlanned = plumbing.planned_hours + piping.planned_hours + sheetMetal.planned_hours;
    const totalActual = plumbing.actual_hours + piping.actual_hours + sheetMetal.actual_hours;
    const totalVariance = totalActual - totalPlanned;
    const totalPercent = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

    return {
      plumbing,
      piping,
      sheet_metal: sheetMetal,
      total: {
        planned_hours: totalPlanned,
        actual_hours: totalActual,
        variance: totalVariance,
        percent_complete: totalPercent
      }
    };
  },

  async delete(id) {
    await db.query('DELETE FROM weekly_goal_plans WHERE id = $1', [id]);
  },
};

module.exports = WeeklyGoalPlan;
