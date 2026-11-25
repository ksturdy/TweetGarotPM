const db = require('../config/database');

const SafetyVisit = {
  async create({ tenantId, projectId, visitType, status, scheduledDate, endDate, assignedTo, travelHoursOw, travelNotes, isOutOfState, createdBy, seriesId, seriesPosition, client }) {
    const number = client
      ? await this._getNextNumberClient(projectId, client)
      : await this.getNextNumber(projectId);
    const result = await (client || db).query(
      `INSERT INTO safety_visits
         (tenant_id, project_id, number, visit_type, status, scheduled_date, end_date, assigned_to,
          travel_hours_ow, travel_notes, is_out_of_state, created_by, series_id, series_position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
        seriesId || null,
        seriesPosition || null,
      ]
    );
    return this.findById(result.rows[0].id);
  },

  async _getNextNumberClient(projectId, client) {
    const result = await client.query(
      'SELECT COALESCE(MAX(number), 0) + 1 AS next FROM safety_visits WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next;
  },

  // Create a recurring series + generate all visit instances in a transaction
  async createSeries({ tenantId, projectId, visitType, assignedTo, travelHoursOw, travelNotes,
                        isOutOfState, frequency, occurrences, endByDate,
                        recurrenceRule, anchorDate, durationDays, createdBy }) {
    // Build a canonical rule object — prefer full recurrenceRule, fall back to legacy params
    const rule = recurrenceRule || {
      type: frequency === 'monthly' ? 'monthly' : 'weekly',
      weeklyInterval: frequency === 'biweekly' ? 2 : 1,
      weeklyDays: null,
      monthlyInterval: 1,
      monthlyType: 'day_of_month',
      endType: endByDate ? 'by_date' : 'occurrences',
      occurrences,
      endByDate,
    };

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert series record
      const seriesRes = await client.query(
        `INSERT INTO safety_visit_series
           (tenant_id, project_id, frequency, occurrences, end_by_date,
            visit_type, assigned_to, travel_hours_ow, travel_notes, is_out_of_state, created_by, recurrence_rule)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [tenantId, projectId, rule.type || frequency || 'weekly',
         rule.occurrences || occurrences || null,
         rule.endByDate || endByDate || null,
         visitType || 'routine', assignedTo || null, travelHoursOw || null,
         travelNotes || null, isOutOfState || false, createdBy,
         JSON.stringify(rule)]
      );
      const series = seriesRes.rows[0];

      // Generate occurrence dates
      const dates = generateOccurrenceDates({ anchorDate, durationDays: durationDays || 0, recurrenceRule: rule, frequency, occurrences, endByDate });

      // Insert all visit rows, using incrementing numbers to avoid race conditions
      const baseNum = await this._getNextNumberClient(projectId, client);
      const visitIds = [];
      for (let i = 0; i < dates.length; i++) {
        const { scheduledDate, endDate } = dates[i];
        const r = await client.query(
          `INSERT INTO safety_visits
             (tenant_id, project_id, number, visit_type, status, scheduled_date, end_date, assigned_to,
              travel_hours_ow, travel_notes, is_out_of_state, created_by, series_id, series_position)
           VALUES ($1,$2,$3,$4,'proposed',$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
          [tenantId, projectId, baseNum + i, visitType || 'routine',
           scheduledDate, endDate || null, assignedTo || null,
           travelHoursOw || null, travelNotes || null, isOutOfState || false,
           createdBy, series.id, i + 1]
        );
        visitIds.push(r.rows[0].id);
      }

      await client.query('COMMIT');
      return { series, visitIds };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Update non-date fields on a series scope ('all' or series_position >= fromPosition)
  async updateSeriesScope(seriesId, tenantId, { scope, fromPosition, fields }) {
    const allowed = ['visit_type', 'assigned_to', 'travel_hours_ow', 'travel_notes', 'is_out_of_state'];
    const setClauses = [];
    const values = [];
    let p = 1;
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        setClauses.push(`${key} = $${p++}`);
        values.push(fields[key]);
      }
    }
    if (setClauses.length === 0) return;

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Update series template record
      const seriesAllowed = ['visit_type', 'assigned_to', 'travel_hours_ow', 'travel_notes', 'is_out_of_state'];
      const sClauses = [];
      const sVals = [];
      let sp = 1;
      for (const key of seriesAllowed) {
        if (fields[key] !== undefined) { sClauses.push(`${key} = $${sp++}`); sVals.push(fields[key]); }
      }
      if (sClauses.length > 0) {
        sVals.push(seriesId, tenantId);
        await client.query(
          `UPDATE safety_visit_series SET ${sClauses.join(', ')}, updated_at = NOW()
           WHERE id = $${sp} AND tenant_id = $${sp + 1}`,
          sVals
        );
      }

      // Update visits
      let visitsQ = `UPDATE safety_visits SET ${setClauses.join(', ')}, updated_at = NOW()
                     WHERE series_id = $${p} AND tenant_id = $${p + 1} AND status != 'completed'`;
      values.push(seriesId, tenantId);
      if (scope === 'forward' && fromPosition != null) {
        p += 2;
        values.push(fromPosition);
        visitsQ += ` AND series_position >= $${p}`;
      }
      await client.query(visitsQ, values);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Delete visits in a series scope and clean up orphaned series row
  async deleteSeriesScope(seriesId, tenantId, { scope, fromPosition }) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      let q = `DELETE FROM safety_visits WHERE series_id = $1 AND tenant_id = $2 AND status != 'completed'`;
      const params = [seriesId, tenantId];
      if (scope === 'forward' && fromPosition != null) {
        params.push(fromPosition);
        q += ` AND series_position >= $3`;
      }
      await client.query(q, params);

      // Clean up series row if no visits remain
      const rem = await client.query(
        'SELECT COUNT(*) AS cnt FROM safety_visits WHERE series_id = $1',
        [seriesId]
      );
      if (parseInt(rem.rows[0].cnt) === 0) {
        await client.query('DELETE FROM safety_visit_series WHERE id = $1 AND tenant_id = $2', [seriesId, tenantId]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async findById(id) {
    const result = await db.query(
      `SELECT v.*,
              p.name  AS project_name,
              p.number AS project_number,
              p.address AS project_address,
              u1.first_name || ' ' || u1.last_name AS assigned_to_name,
              u2.first_name || ' ' || u2.last_name AS completed_by_name,
              u3.first_name || ' ' || u3.last_name AS created_by_name,
              s.frequency AS series_frequency,
              s.occurrences AS series_occurrences,
              s.end_by_date AS series_end_by_date
       FROM safety_visits v
       JOIN projects p ON v.project_id = p.id
       LEFT JOIN users u1 ON v.assigned_to = u1.id
       LEFT JOIN users u2 ON v.completed_by = u2.id
       LEFT JOIN users u3 ON v.created_by = u3.id
       LEFT JOIN safety_visit_series s ON v.series_id = s.id
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
             p.name       AS project_name,
             p.number     AS project_number,
             p.address    AS project_address,
             vc.ship_city  AS project_city,
             vc.ship_state AS project_state,
             u1.first_name || ' ' || u1.last_name AS assigned_to_name,
             svs.frequency AS series_frequency
      FROM safety_visits v
      JOIN projects p ON v.project_id = p.id
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      LEFT JOIN users u1 ON v.assigned_to = u1.id
      LEFT JOIN safety_visit_series svs ON v.series_id = svs.id
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
        vc.ship_city,
        vc.ship_state,
        p.start_date,
        p.end_date,
        CASE
          WHEN vc.projected_revenue > 0
          THEN LEAST(100, ROUND((vc.earned_revenue / vc.projected_revenue) * 100))::int
          ELSE 0
        END AS percent_complete,
        p.status        AS project_status,
        p.department_id,
        d.name          AS department_name,
        mgr.first_name || ' ' || mgr.last_name AS manager_name,
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
      LEFT JOIN rem_hours r   ON r.project_id = p.id
      LEFT JOIN last_visit lv ON lv.project_id = p.id
      LEFT JOIN departments d ON d.id = p.department_id
      LEFT JOIN employees mgr ON mgr.id = p.manager_id
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
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

  async getProjectInfo(projectId, tenantId) {
    // Core project info — no Vista dependency
    const projRes = await db.query(
      `SELECT p.id, p.name, p.number, p.address, p.start_date, p.end_date,
              p.status AS project_status,
              mgr.first_name || ' ' || mgr.last_name AS manager_name,
              d.name AS department_name
       FROM projects p
       LEFT JOIN users mgr ON mgr.id = p.manager_id
       LEFT JOIN departments d  ON d.id  = p.department_id
       WHERE p.id = $1 AND p.tenant_id = $2
       LIMIT 1`,
      [projectId, tenantId]
    );
    if (!projRes.rows[0]) return null;
    const base = { ...projRes.rows[0], percent_complete: 0, ship_city: null, ship_state: null };

    // Vista city/state + percent complete — optional, skip if table missing
    let ship_city = null, ship_state = null, percent_complete = 0;
    try {
      const vcRes = await db.query(
        `SELECT ship_city, ship_state,
                CASE WHEN projected_revenue > 0
                     THEN LEAST(100, ROUND((earned_revenue / projected_revenue) * 100))::int
                     ELSE 0 END AS percent_complete
         FROM vp_contracts WHERE linked_project_id = $1 LIMIT 1`,
        [projectId]
      );
      if (vcRes.rows[0]) {
        ship_city = vcRes.rows[0].ship_city;
        ship_state = vcRes.rows[0].ship_state;
        percent_complete = vcRes.rows[0].percent_complete ?? 0;
      }
    } catch (_) { /* Vista tables not available */ }

    // Vista labor by trade — optional, skip if table missing
    let labor_by_trade = [];
    try {
      const laborRes = await db.query(
        `SELECT COALESCE(NULLIF(TRIM(pc.description), ''), 'Other') AS trade,
                COALESCE(SUM(pc.est_hours),  0)::float AS est_hours,
                COALESCE(SUM(pc.jtd_hours),  0)::float AS jtd_hours,
                GREATEST(0, COALESCE(SUM(pc.est_hours - pc.jtd_hours), 0))::float AS remaining_hours
         FROM vp_phase_codes pc
         WHERE pc.linked_project_id = $1 AND pc.tenant_id = $2 AND pc.cost_type = 1
         GROUP BY COALESCE(NULLIF(TRIM(pc.description), ''), 'Other')
         ORDER BY remaining_hours DESC
         LIMIT 15`,
        [projectId, tenantId]
      );
      labor_by_trade = laborRes.rows;
    } catch (_) { /* Vista tables not available */ }

    return { ...base, ship_city, ship_state, percent_complete, labor_by_trade };
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
    const existing = await db.query('SELECT series_id FROM safety_visits WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    const seriesId = existing.rows[0]?.series_id;
    await db.query('DELETE FROM safety_visits WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (seriesId) {
      const rem = await db.query('SELECT COUNT(*) AS cnt FROM safety_visits WHERE series_id = $1', [seriesId]);
      if (parseInt(rem.rows[0].cnt) === 0) {
        await db.query('DELETE FROM safety_visit_series WHERE id = $1', [seriesId]);
      }
    }
  },

  async getNextNumber(projectId) {
    const result = await db.query(
      'SELECT COALESCE(MAX(number), 0) + 1 AS next FROM safety_visits WHERE project_id = $1',
      [projectId]
    );
    return result.rows[0].next;
  },
};

// weekday convention throughout: 0=Mon … 6=Sun
// JS getDay(): 0=Sun … 6=Sat → convert with jsToOur / ourToJs helpers
function jsToOur(jsDay) { return jsDay === 0 ? 6 : jsDay - 1; }
function ourToJs(ourDay) { return ourDay === 6 ? 0 : ourDay + 1; }

function fmtDate(d) { return d.toISOString().slice(0, 10); }

function makeOccurrence(d, durationDays) {
  return {
    scheduledDate: fmtDate(d),
    endDate: durationDays > 0 ? fmtDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + durationDays)) : null,
  };
}

// Return the date of the Nth weekday (0=Mon…6=Sun) in a given month.
// week: 1–4 or -1 (last). Returns null if that Nth doesn't exist in the month.
function nthWeekdayOfMonth(year, month, week, ourWeekday) {
  const jsWd = ourToJs(ourWeekday);
  if (week === -1) {
    let d = new Date(year, month + 1, 0); // last day of month
    while (d.getDay() !== jsWd) d.setDate(d.getDate() - 1);
    return d;
  }
  let d = new Date(year, month, 1);
  while (d.getDay() !== jsWd) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + (week - 1) * 7);
  return d.getMonth() === month ? d : null;
}

function generateOccurrenceDates({ anchorDate, durationDays, recurrenceRule, frequency, occurrences, endByDate }) {
  // Support old-style params for backward compat
  if (!recurrenceRule && frequency) {
    const freqMap = { weekly: 'weekly', biweekly: 'weekly', monthly: 'monthly' };
    const intervalMap = { weekly: 1, biweekly: 2, monthly: 1 };
    recurrenceRule = {
      type: freqMap[frequency] || 'weekly',
      weeklyInterval: intervalMap[frequency],
      weeklyDays: [new Date(anchorDate + 'T00:00:00').getDay() === 0 ? 6 : new Date(anchorDate + 'T00:00:00').getDay() - 1],
      monthlyInterval: 1,
      monthlyType: 'day_of_month',
      endType: endByDate ? 'by_date' : 'occurrences',
      occurrences,
      endByDate,
    };
  }

  const { type, endType } = recurrenceRule;
  const start = new Date(anchorDate + 'T00:00:00');
  const dur = durationDays || 0;

  const maxCount = endType === 'occurrences'
    ? Math.min(recurrenceRule.occurrences || 10, 52)
    : 52;
  const maxDate = endType === 'by_date' && recurrenceRule.endByDate
    ? new Date(recurrenceRule.endByDate + 'T00:00:00')
    : new Date(start.getFullYear() + 2, start.getMonth(), start.getDate());

  const results = [];

  // ── Daily ──────────────────────────────────────────────────────────────────
  if (type === 'daily') {
    const interval = recurrenceRule.dailyInterval || 1;
    const weekdaysOnly = !!recurrenceRule.dailyWeekdaysOnly;
    let cur = new Date(start);
    while (results.length < maxCount && cur <= maxDate) {
      const jsDay = cur.getDay();
      if (!weekdaysOnly || (jsDay >= 1 && jsDay <= 5)) {
        results.push(makeOccurrence(cur, dur));
      }
      cur = new Date(cur);
      cur.setDate(cur.getDate() + (weekdaysOnly ? 1 : interval));
    }
  }

  // ── Weekly ─────────────────────────────────────────────────────────────────
  else if (type === 'weekly') {
    const interval = recurrenceRule.weeklyInterval || 1;
    const days = (recurrenceRule.weeklyDays || [jsToOur(start.getDay())]).slice().sort((a, b) => a - b);
    if (days.length === 0) return [];

    // Rewind to Monday of the anchor week
    const anchorDow = jsToOur(start.getDay());
    let weekMon = new Date(start);
    weekMon.setDate(weekMon.getDate() - anchorDow);

    while (results.length < maxCount && weekMon <= maxDate) {
      for (const ourDay of days) {
        const d = new Date(weekMon);
        d.setDate(weekMon.getDate() + ourDay);
        if (d >= start && d <= maxDate && results.length < maxCount) {
          results.push(makeOccurrence(d, dur));
        }
      }
      weekMon.setDate(weekMon.getDate() + 7 * interval);
    }
  }

  // ── Monthly ────────────────────────────────────────────────────────────────
  else if (type === 'monthly') {
    const interval = recurrenceRule.monthlyInterval || 1;

    if ((recurrenceRule.monthlyType || 'day_of_month') === 'day_of_month') {
      const day = recurrenceRule.monthlyDay || start.getDate();
      let yr = start.getFullYear(), mo = start.getMonth();
      // Start at anchor month; if that date is before start advance one interval
      let cur = new Date(yr, mo, day);
      if (cur < start) { mo += interval; cur = new Date(yr, mo, day); }
      while (results.length < maxCount && cur <= maxDate) {
        results.push(makeOccurrence(cur, dur));
        mo += interval;
        cur = new Date(yr + Math.floor(mo / 12), mo % 12, day);
        if (mo >= 12) yr += Math.floor(mo / 12);
      }
    } else {
      const week = recurrenceRule.monthlyWeek || 1;
      const weekday = recurrenceRule.monthlyWeekday !== undefined ? recurrenceRule.monthlyWeekday : jsToOur(start.getDay());
      let yr = start.getFullYear(), mo = start.getMonth();
      while (results.length < maxCount) {
        const d = nthWeekdayOfMonth(yr, mo, week, weekday);
        if (!d) { /* skip invalid combos */ }
        else if (d > maxDate) break;
        else if (d >= start) results.push(makeOccurrence(d, dur));
        mo += interval;
        if (mo >= 12) { yr += Math.floor(mo / 12); mo = mo % 12; }
      }
    }
  }

  // ── Yearly ─────────────────────────────────────────────────────────────────
  else if (type === 'yearly') {
    const interval = recurrenceRule.yearlyInterval || 1;
    const month = recurrenceRule.yearlyMonth != null ? recurrenceRule.yearlyMonth - 1 : start.getMonth();

    if ((recurrenceRule.yearlyType || 'day_of_month') === 'day_of_month') {
      const day = recurrenceRule.yearlyDay || start.getDate();
      let yr = start.getFullYear();
      let cur = new Date(yr, month, day);
      if (cur < start) cur = new Date(yr + interval, month, day);
      while (results.length < maxCount && cur <= maxDate) {
        results.push(makeOccurrence(cur, dur));
        cur = new Date(cur.getFullYear() + interval, month, day);
      }
    } else {
      const week = recurrenceRule.yearlyWeek || 1;
      const weekday = recurrenceRule.yearlyWeekday !== undefined ? recurrenceRule.yearlyWeekday : jsToOur(start.getDay());
      let yr = start.getFullYear();
      while (results.length < maxCount) {
        const d = nthWeekdayOfMonth(yr, month, week, weekday);
        if (!d) { yr += interval; continue; }
        if (d > maxDate) break;
        if (d >= start) results.push(makeOccurrence(d, dur));
        yr += interval;
      }
    }
  }

  return results;
}

module.exports = SafetyVisit;
