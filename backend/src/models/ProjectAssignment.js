const db = require('../config/database');
const { getProjectEffectiveDates } = require('../utils/projectDates');

const SELECT_WITH_JOINS = `
  pa.*,
  e.first_name,
  e.last_name,
  e.email,
  e.phone,
  e.mobile_phone,
  e.job_title,
  e.title as employee_title,
  e.trade as employee_trade,
  e.employee_group,
  e.profile_type,
  e.user_id as emp_user_id,
  p.name as project_name,
  p.number as project_number,
  p.address as project_address,
  NULL as project_city,
  NULL as project_state,
  NULL as project_zip
`;

const ProjectAssignment = {
  async findByUserId(userId, tenantId) {
    const result = await db.query(
      `SELECT pa.*, p.name as project_name, p.number as project_number
       FROM project_assignments pa
       JOIN projects p ON p.id = pa.project_id
       WHERE pa.user_id = $1 AND pa.tenant_id = $2
       ORDER BY p.name`,
      [userId, tenantId]
    );
    return result.rows;
  },

  async findByProjectId(projectId, tenantId) {
    const result = await db.query(
      `SELECT ${SELECT_WITH_JOINS}
       FROM project_assignments pa
       JOIN employees e ON e.id = pa.employee_id
       JOIN projects p ON p.id = pa.project_id
       WHERE pa.project_id = $1 AND pa.tenant_id = $2
       ORDER BY pa.start_date DESC NULLS LAST, e.last_name, e.first_name`,
      [projectId, tenantId]
    );
    return result.rows;
  },

  async findById(id, tenantId) {
    const result = await db.query(
      `SELECT ${SELECT_WITH_JOINS}
       FROM project_assignments pa
       JOIN employees e ON e.id = pa.employee_id
       JOIN projects p ON p.id = pa.project_id
       WHERE pa.id = $1 AND pa.tenant_id = $2`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async findByEmployeeAndScope(employeeId, tenantId, scope) {
    let dateClause = '';
    if (scope === 'current') {
      dateClause = `AND (pa.start_date IS NULL OR pa.start_date <= CURRENT_DATE)
                    AND (pa.end_date IS NULL OR pa.end_date >= CURRENT_DATE)
                    AND pa.status NOT IN ('cancelled', 'completed')`;
    } else if (scope === 'upcoming') {
      dateClause = `AND pa.start_date > CURRENT_DATE
                    AND pa.status NOT IN ('cancelled', 'completed')`;
    } else if (scope === 'past') {
      dateClause = `AND (pa.end_date < CURRENT_DATE OR pa.status IN ('completed', 'cancelled'))`;
    }

    const result = await db.query(
      `SELECT ${SELECT_WITH_JOINS}
       FROM project_assignments pa
       JOIN employees e ON e.id = pa.employee_id
       JOIN projects p ON p.id = pa.project_id
       WHERE pa.employee_id = $1 AND pa.tenant_id = $2
       ${dateClause}
       ORDER BY pa.start_date ${scope === 'past' ? 'DESC' : 'ASC'} NULLS LAST`,
      [employeeId, tenantId]
    );
    return result.rows;
  },

  async findByDateRange(tenantId, fromDate, toDate) {
    const result = await db.query(
      `SELECT ${SELECT_WITH_JOINS}
       FROM project_assignments pa
       JOIN employees e ON e.id = pa.employee_id
       JOIN projects p ON p.id = pa.project_id
       WHERE pa.tenant_id = $1
         AND pa.status NOT IN ('cancelled')
         AND COALESCE(pa.start_date, $2::date) <= $3::date
         AND COALESCE(pa.end_date, $3::date) >= $2::date
       ORDER BY pa.start_date NULLS LAST, e.last_name`,
      [tenantId, fromDate, toDate]
    );
    return result.rows;
  },

  async findAllForBoard(tenantId, filters = {}) {
    const params = [tenantId];
    let where = `WHERE e.tenant_id = $1 AND e.employment_status = 'active'`;

    if (filters.trade) {
      params.push(filters.trade);
      where += ` AND e.trade = $${params.length}`;
    }
    if (filters.title) {
      params.push(filters.title);
      where += ` AND e.title = $${params.length}`;
    }
    if (filters.employee_group) {
      params.push(filters.employee_group);
      where += ` AND e.employee_group = $${params.length}`;
    }
    if (filters.profile_type) {
      params.push(filters.profile_type);
      where += ` AND e.profile_type = $${params.length}`;
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      where += ` AND (e.first_name ILIKE $${params.length}
                  OR e.last_name ILIKE $${params.length}
                  OR e.email ILIKE $${params.length})`;
    }

    const sql = `
      WITH current_a AS (
        SELECT DISTINCT ON (pa.employee_id) pa.employee_id, pa.project_id, pa.end_date, pa.role, pa.start_date, p.name as project_name, p.number as project_number
        FROM project_assignments pa
        JOIN projects p ON p.id = pa.project_id
        WHERE pa.tenant_id = $1
          AND pa.status NOT IN ('cancelled', 'completed')
          AND (pa.start_date IS NULL OR pa.start_date <= CURRENT_DATE)
          AND (pa.end_date IS NULL OR pa.end_date >= CURRENT_DATE)
        ORDER BY pa.employee_id, pa.start_date NULLS LAST
      ),
      next_a AS (
        SELECT DISTINCT ON (pa.employee_id) pa.employee_id, pa.project_id, pa.start_date, pa.end_date, pa.role, p.name as project_name, p.number as project_number
        FROM project_assignments pa
        JOIN projects p ON p.id = pa.project_id
        WHERE pa.tenant_id = $1
          AND pa.status NOT IN ('cancelled', 'completed')
          AND pa.start_date > CURRENT_DATE
        ORDER BY pa.employee_id, pa.start_date ASC
      )
      SELECT e.id, e.first_name, e.last_name, e.email, e.phone, e.mobile_phone,
             e.job_title, e.title, e.trade, e.employee_group, e.profile_type,
             e.hire_date,
             ca.project_id as current_project_id,
             ca.project_name as current_project_name,
             ca.project_number as current_project_number,
             ca.end_date as current_end_date,
             ca.start_date as current_start_date,
             ca.role as current_role,
             na.project_id as next_project_id,
             na.project_name as next_project_name,
             na.project_number as next_project_number,
             na.start_date as next_start_date,
             na.role as next_role,
             CASE WHEN ca.employee_id IS NULL THEN 'available' ELSE 'assigned' END as availability
      FROM employees e
      LEFT JOIN current_a ca ON ca.employee_id = e.id
      LEFT JOIN next_a na ON na.employee_id = e.id
      ${where}
      ORDER BY e.last_name, e.first_name
    `;

    const result = await db.query(sql, params);
    return result.rows;
  },

  async getProjectIdsForUser(userId, tenantId) {
    const result = await db.query(
      `SELECT DISTINCT pa.project_id FROM project_assignments pa
       LEFT JOIN employees e ON e.id = pa.employee_id
       WHERE pa.tenant_id = $1
         AND (pa.user_id = $2 OR e.user_id = $2)`,
      [tenantId, userId]
    );
    return result.rows.map(r => r.project_id);
  },

  async isAssigned(userId, projectId, tenantId) {
    const result = await db.query(
      `SELECT 1 FROM project_assignments pa
       LEFT JOIN employees e ON e.id = pa.employee_id
       WHERE pa.project_id = $1 AND pa.tenant_id = $2
         AND (pa.user_id = $3 OR e.user_id = $3)`,
      [projectId, tenantId, userId]
    );
    return result.rows.length > 0;
  },

  async addToProject(payload, tenantId, assignedBy) {
    const {
      employeeId,
      projectId,
      trade,
      role,
      startDate,
      endDate,
      startDateOverridden,
      endDateOverridden,
      shiftPattern,
      shiftStartTime,
      shiftEndTime,
      status,
      notes,
      tags,
    } = payload;

    // Fill missing dates from the project's effective default (and mark them
    // as inherited so the UI can render them differently from user-set dates).
    let resolvedStart = startDate || null;
    let resolvedEnd = endDate || null;
    let resolvedStartOverridden = startDateOverridden === true;
    let resolvedEndOverridden = endDateOverridden === true;

    if (!resolvedStart || !resolvedEnd) {
      const defaults = await getProjectEffectiveDates(projectId, tenantId);
      if (!resolvedStart) {
        resolvedStart = defaults.start_date;
        resolvedStartOverridden = false;
      }
      if (!resolvedEnd) {
        resolvedEnd = defaults.end_date;
        resolvedEndOverridden = false;
      }
    }

    const empResult = await db.query('SELECT user_id FROM employees WHERE id = $1', [employeeId]);
    const userId = empResult.rows[0]?.user_id || null;

    const result = await db.query(
      `INSERT INTO project_assignments (
         employee_id, user_id, project_id, tenant_id,
         trade, role, start_date, end_date,
         start_date_overridden, end_date_overridden,
         shift_pattern, shift_start_time, shift_end_time,
         status, notes, tags, assigned_by
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (employee_id, project_id, start_date) DO UPDATE SET
         trade = EXCLUDED.trade,
         role = EXCLUDED.role,
         end_date = EXCLUDED.end_date,
         start_date_overridden = EXCLUDED.start_date_overridden,
         end_date_overridden = EXCLUDED.end_date_overridden,
         shift_pattern = EXCLUDED.shift_pattern,
         shift_start_time = EXCLUDED.shift_start_time,
         shift_end_time = EXCLUDED.shift_end_time,
         status = EXCLUDED.status,
         notes = EXCLUDED.notes,
         tags = EXCLUDED.tags
       RETURNING *`,
      [
        employeeId,
        userId,
        projectId,
        tenantId,
        trade || null,
        role || null,
        resolvedStart,
        resolvedEnd,
        resolvedStartOverridden,
        resolvedEndOverridden,
        shiftPattern || null,
        shiftStartTime || null,
        shiftEndTime || null,
        status || 'planned',
        notes || null,
        tags && tags.length ? tags : null,
        assignedBy,
      ]
    );
    return result.rows[0];
  },

  async updateAssignment(id, tenantId, patch) {
    const allowed = [
      'trade', 'role', 'start_date', 'end_date',
      'start_date_overridden', 'end_date_overridden',
      'shift_pattern', 'shift_start_time', 'shift_end_time',
      'status', 'notes', 'tags',
    ];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        params.push(patch[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (sets.length === 0) {
      return this.findById(id, tenantId);
    }
    params.push(id, tenantId);
    const result = await db.query(
      `UPDATE project_assignments
       SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
       RETURNING *`,
      params
    );
    return result.rows[0];
  },

  async deleteById(id, tenantId) {
    const result = await db.query(
      `DELETE FROM project_assignments WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  async removeFromProject(employeeId, projectId, tenantId) {
    const result = await db.query(
      `DELETE FROM project_assignments
       WHERE employee_id = $1 AND project_id = $2 AND tenant_id = $3
       RETURNING *`,
      [employeeId, projectId, tenantId]
    );
    return result.rows[0];
  },

  async updateTrade(employeeId, projectId, tenantId, trade) {
    const result = await db.query(
      `UPDATE project_assignments SET trade = $1
       WHERE employee_id = $2 AND project_id = $3 AND tenant_id = $4
       RETURNING *`,
      [trade, employeeId, projectId, tenantId]
    );
    return result.rows[0];
  },

  async assign(userId, projectId, tenantId, assignedBy) {
    const result = await db.query(
      `INSERT INTO project_assignments (user_id, project_id, tenant_id, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [userId, projectId, tenantId, assignedBy]
    );
    return result.rows[0];
  },

  async unassign(userId, projectId, tenantId) {
    const result = await db.query(
      `DELETE FROM project_assignments
       WHERE user_id = $1 AND project_id = $2 AND tenant_id = $3
       RETURNING *`,
      [userId, projectId, tenantId]
    );
    return result.rows[0];
  },

  async syncForUser(userId, projectIds, tenantId, assignedBy) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM project_assignments WHERE user_id = $1 AND tenant_id = $2`,
        [userId, tenantId]
      );
      if (projectIds && projectIds.length > 0) {
        const values = projectIds.map((pid, i) =>
          `($1, $${i + 2}, $${projectIds.length + 2}, $${projectIds.length + 3})`
        ).join(', ');
        const params = [userId, ...projectIds, tenantId, assignedBy];
        await client.query(
          `INSERT INTO project_assignments (user_id, project_id, tenant_id, assigned_by)
           VALUES ${values}`,
          params
        );
      }
      await client.query('COMMIT');
      return this.findByUserId(userId, tenantId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async summary(tenantId) {
    const result = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM employees WHERE tenant_id = $1 AND employment_status = 'active') AS total_employees,
         (SELECT COUNT(DISTINCT pa.employee_id) FROM project_assignments pa
            WHERE pa.tenant_id = $1
              AND pa.status NOT IN ('cancelled','completed')
              AND (pa.start_date IS NULL OR pa.start_date <= CURRENT_DATE)
              AND (pa.end_date IS NULL OR pa.end_date >= CURRENT_DATE)) AS currently_assigned,
         (SELECT COUNT(*) FROM project_assignments pa
            WHERE pa.tenant_id = $1
              AND pa.status NOT IN ('cancelled','completed')
              AND pa.start_date > CURRENT_DATE) AS upcoming_assignments,
         (SELECT COUNT(*) FROM project_assignments pa
            WHERE pa.tenant_id = $1
              AND pa.status NOT IN ('cancelled','completed')
              AND pa.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '14 days')) AS ending_within_two_weeks`,
      [tenantId]
    );
    return result.rows[0];
  },
};

module.exports = ProjectAssignment;
