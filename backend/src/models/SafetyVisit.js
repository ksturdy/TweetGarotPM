const db = require('../config/database');

const SafetyVisit = {
  async create({ tenantId, projectId, visitType, status, scheduledDate, endDate, assignedTo, travelHoursOw, travelNotes, isOutOfState, createdBy }) {
    const number = await this.getNextNumber(projectId);
    const result = await db.query(
      `INSERT INTO safety_visits
         (tenant_id, project_id, number, visit_type, status, scheduled_date, end_date, assigned_to,
          travel_hours_ow, travel_notes, is_out_of_state, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        tenantId, projectId, number,
        visitType || 'routine',
        status || 'proposed',
        scheduledDate || null,
        endDate || null,
        assignedTo || null,
        travelHoursOw || null,
        travelNotes || null,
        isOutOfState || false,
        createdBy,
      ]
    );
    return this.findById(result.rows[0].id);
  },

  async findById(id) {
    const result = await db.query(
      `SELECT v.*,
              p.name  AS project_name,
              p.number AS project_number,
              p.address AS project_address,
              u1.first_name || ' ' || u1.last_name AS assigned_to_name,
              u2.first_name || ' ' || u2.last_name AS completed_by_name,
              u3.first_name || ' ' || u3.last_name AS created_by_name
       FROM safety_visits v
       JOIN projects p ON v.project_id = p.id
       LEFT JOIN users u1 ON v.assigned_to = u1.id
       LEFT JOIN users u2 ON v.completed_by = u2.id
       LEFT JOIN users u3 ON v.created_by = u3.id
       WHERE v.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async findByProject(projectId, tenantId) {
    const result = await db.query(
      `SELECT v.*,
              u1.first_name || ' ' || u1.last_name AS assigned_to_name,
              u2.first_name || ' ' || u2.last_name AS completed_by_name
       FROM safety_visits v
       LEFT JOIN users u1 ON v.assigned_to = u1.id
       LEFT JOIN users u2 ON v.completed_by = u2.id
       WHERE v.project_id = $1 AND v.tenant_id = $2
       ORDER BY v.scheduled_date ASC NULLS LAST, v.created_at DESC`,
      [projectId, tenantId]
    );
    return result.rows;
  },

  // Returns visits whose span overlaps the given date window
  async findByTenant(tenantId, { startDate, endDate, assignedTo } = {}) {
    let q = `
      SELECT v.*,
             p.name    AS project_name,
             p.number  AS project_number,
             p.address AS project_address,
             u1.first_name || ' ' || u1.last_name AS assigned_to_name
      FROM safety_visits v
      JOIN projects p ON v.project_id = p.id
      LEFT JOIN users u1 ON v.assigned_to = u1.id
      WHERE v.tenant_id = $1
    `;
    const params = [tenantId];

    if (startDate) {
      params.push(startDate);
      q += ` AND COALESCE(v.end_date, v.scheduled_date) >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      q += ` AND v.scheduled_date <= $${params.length}`;
    }
    if (assignedTo) {
      params.push(assignedTo);
      q += ` AND v.assigned_to = $${params.length}`;
    }

    q += ' ORDER BY v.scheduled_date ASC NULLS LAST, v.created_at DESC';
    const result = await db.query(q, params);
    return result.rows;
  },

  // Projects enriched with priority score + last visit (for the sidebar)
  async getProjectsWithPriority(tenantId, { teamId, departmentId, statuses } = {}) {
    let q = `
      WITH rem_hours AS (
        SELECT pc.linked_project_id AS project_id,
               COALESCE(SUM(GREATEST(0, pc.est_hours - pc.jtd_hours)), 0) AS remaining_hours
        FROM vp_phase_codes pc
        WHERE pc.tenant_id = $1
          AND pc.cost_type = 1
          AND pc.linked_project_id IS NOT NULL
        GROUP BY pc.linked_project_id
      ),
      last_visit AS (
        SELECT project_id,
               MAX(completed_date) AS last_visit_date,
               COUNT(*) FILTER (WHERE status = 'completed') AS completed_count
        FROM safety_visits
        WHERE tenant_id = $1
        GROUP BY project_id
      )
      SELECT
        p.id,
        p.name,
        p.number,
        p.address,
        p.start_date,
        p.end_date,
        p.percent_complete,
        p.status        AS project_status,
        p.department_id,
        d.name          AS department_name,
        COALESCE(r.remaining_hours, 0)::float AS remaining_hours,
        lv.last_visit_date,
        lv.completed_count,
        EXTRACT(DAYS FROM NOW() - lv.last_visit_date)::int AS days_since_last_visit,
        (
          COALESCE(r.remaining_hours, 0) / 200.0
          + COALESCE(EXTRACT(DAYS FROM NOW() - lv.last_visit_date), 90) / 7.0
          + CASE
              WHEN p.start_date >= NOW() - INTERVAL '30 days'
               AND COALESCE(lv.completed_count, 0) = 0
              THEN 15
              ELSE 0
            END
        )::float AS priority_score,
        (
          p.start_date >= NOW() - INTERVAL '30 days'
          AND COALESCE(lv.completed_count, 0) = 0
        ) AS needs_kickoff
      FROM projects p
      LEFT JOIN rem_hours r  ON r.project_id = p.id
      LEFT JOIN last_visit lv ON lv.project_id = p.id
      LEFT JOIN departments d ON d.id = p.department_id
      WHERE p.tenant_id = $1
    `;
    const params = [tenantId];

    // Status filter — defaults to Open + Soft-Closed when not provided
    const activeStatuses = (statuses && statuses.length > 0)
      ? statuses
      : ['Open', 'Soft-Closed'];
    const placeholders = activeStatuses.map((_, i) => `$${params.length + 1 + i}`).join(', ');
    params.push(...activeStatuses);
    q += ` AND p.status IN (${placeholders})`;

    if (departmentId) {
      params.push(departmentId);
      q += ` AND p.department_id = $${params.length}`;
    }

    if (teamId) {
      params.push(teamId);
      q += `
        AND p.manager_id IN (
          SELECT e.id FROM employees e
          JOIN team_members tm ON tm.employee_id = e.id
          WHERE tm.team_id = $${params.length}
        )
      `;
    }

    q += ' ORDER BY priority_score DESC, p.name ASC LIMIT 150';

    const result = await db.query(q, params);
    return result.rows;
  },

  async update(id, tenantId, fields) {
    const allowed = ['visit_type', 'status', 'scheduled_date', 'end_date', 'assigned_to',
                     'travel_hours_ow', 'travel_notes', 'is_out_of_state',
                     'report_weather', 'report_temp', 'report_notes', 'report_sections'];
    const setClauses = [];
    const values = [];
    let p = 1;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        setClauses.push(`${key} = $${p++}`);
        values.push(key === 'report_sections' ? JSON.stringify(fields[key]) : fields[key]);
      }
    }

    if (setClauses.length === 0) return this.findById(id);

    values.push(id, tenantId);
    const result = await db.query(
      `UPDATE safety_visits SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${p} AND tenant_id = $${p + 1}
       RETURNING *`,
      values
    );
    if (!result.rows[0]) return null;
    return this.findById(id);
  },

  // Move a visit to a new start/end date (preserves or updates duration)
  async reschedule(id, tenantId, scheduledDate, endDate) {
    const result = await db.query(
      `UPDATE safety_visits
       SET scheduled_date = $1,
           end_date       = $2,
           status = CASE WHEN status = 'proposed' THEN 'confirmed' ELSE status END,
           updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [scheduledDate, endDate || null, id, tenantId]
    );
    if (!result.rows[0]) return null;
    return this.findById(id);
  },

  async complete(id, tenantId, { completedDate, completedBy, reportWeather, reportTemp, reportNotes, reportSections }) {
    const result = await db.query(
      `UPDATE safety_visits
       SET status = 'completed',
           completed_date  = $1,
           completed_by    = $2,
           report_weather  = $3,
           report_temp     = $4,
           report_notes    = $5,
           report_sections = $6,
           updated_at = NOW()
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [
        completedDate || new Date().toISOString().slice(0, 10),
        completedBy || null,
        reportWeather || null,
        reportTemp !== undefined ? reportTemp : null,
        reportNotes || null,
        JSON.stringify(reportSections || []),
        id, tenantId,
      ]
    );
    if (!result.rows[0]) return null;
    return this.findById(id);
  },

  async delete(id, tenantId) {
    await db.query('DELETE FROM safety_visits WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  },

  async getNextNumber(projectId) {
    const result = await db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 AS next FROM safety_visits WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next;
  },
};

module.exports = SafetyVisit;
