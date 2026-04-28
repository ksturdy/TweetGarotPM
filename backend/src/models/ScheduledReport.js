const db = require('../config/database');

class ScheduledReport {
  /**
   * Compute the next run timestamp for a schedule.
   * Returns an ISO string suitable for TIMESTAMPTZ.
   */
  static computeNextRun(frequency, dayOfWeek, dayOfMonth, timeOfDay, timezone, afterDate = null) {
    // We'll compute in UTC by building a target date in the given timezone.
    // For simplicity, use a loop approach: start from "now" (or afterDate) and find the next matching slot.
    const now = afterDate ? new Date(afterDate) : new Date();

    // Parse time_of_day "HH:MM" or "HH:MM:SS"
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    // Helper: build a Date for a given date + time in the target timezone
    const buildTarget = (year, month, day) => {
      // Create a date string in the target timezone, then convert to UTC
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
      // Use Intl to find the UTC offset for this datetime in the timezone
      try {
        const target = new Date(new Date(dateStr + 'Z').toLocaleString('en-US', { timeZone: 'UTC' }));
        // Get what time it is in the target timezone when it's dateStr in UTC
        // Actually, let's use a simpler approach: create date in target tz
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false,
        });

        // We need the inverse: given a local time in `timezone`, find the UTC equivalent.
        // Approach: guess UTC, then adjust based on the offset we observe.
        const guessUtc = new Date(`${dateStr}Z`);
        const parts = formatter.formatToParts(guessUtc);
        const getPart = (type) => parseInt(parts.find(p => p.type === type)?.value || '0');
        const localHour = getPart('hour');
        const localMinute = getPart('minute');
        const localDay = getPart('day');
        const localMonth = getPart('month') - 1;

        // Offset in minutes = (local - utc) observed
        // If guessUtc shows localHour in the timezone, then offset = localTime - utcTime
        const utcMinutes = guessUtc.getUTCHours() * 60 + guessUtc.getUTCMinutes();
        const localMinutes = localHour * 60 + localMinute;
        let dayDiff = localDay - guessUtc.getUTCDate();
        if (dayDiff > 15) dayDiff -= 30; // month wrap
        if (dayDiff < -15) dayDiff += 30;
        const offsetMinutes = dayDiff * 1440 + localMinutes - utcMinutes;

        // The actual UTC time when it's `dateStr` in the target timezone:
        const actualUtc = new Date(guessUtc.getTime() - offsetMinutes * 60000);
        return actualUtc;
      } catch {
        // Fallback: treat as UTC
        return new Date(`${dateStr}Z`);
      }
    };

    if (frequency === 'daily') {
      // Next occurrence: today at time_of_day, or tomorrow if already past
      for (let offset = 0; offset <= 2; offset++) {
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + offset);
        const target = buildTarget(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
        if (target > now) return target.toISOString();
      }
    }

    if (frequency === 'weekly') {
      // Find next occurrence of dayOfWeek
      for (let offset = 0; offset <= 7; offset++) {
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + offset);
        if (candidate.getDay() === dayOfWeek || (offset === 7)) {
          // Check day of week in target timezone
          const target = buildTarget(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
          // Verify the day in the target timezone
          const tzDay = new Date(target.toLocaleString('en-US', { timeZone: timezone })).getDay();
          if (tzDay === dayOfWeek && target > now) return target.toISOString();
        }
      }
      // Fallback: 7 days from now
      const fallback = new Date(now);
      fallback.setDate(fallback.getDate() + 7);
      return buildTarget(fallback.getFullYear(), fallback.getMonth(), fallback.getDate()).toISOString();
    }

    if (frequency === 'monthly') {
      // Find next occurrence of dayOfMonth
      for (let monthOffset = 0; monthOffset <= 2; monthOffset++) {
        const candidate = new Date(now);
        candidate.setMonth(candidate.getMonth() + monthOffset);
        const targetDay = Math.min(dayOfMonth, new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate());
        const target = buildTarget(candidate.getFullYear(), candidate.getMonth(), targetDay);
        if (target > now) return target.toISOString();
      }
    }

    // Absolute fallback: 1 day from now
    const fb = new Date(now);
    fb.setDate(fb.getDate() + 1);
    return fb.toISOString();
  }

  static async findAllByTenant(tenantId) {
    const result = await db.query(
      `SELECT sr.*,
        u.first_name || ' ' || u.last_name AS created_by_name,
        COALESCE(
          (SELECT json_agg(json_build_object('user_id', srr.user_id, 'first_name', ru.first_name, 'last_name', ru.last_name, 'email', ru.email))
           FROM scheduled_report_recipients srr
           JOIN users ru ON srr.user_id = ru.id
           WHERE srr.scheduled_report_id = sr.id),
          '[]'::json
        ) AS recipients,
        COALESCE(
          (SELECT json_agg(json_build_object('team_id', srt.team_id, 'name', t.name, 'color', t.color))
           FROM scheduled_report_team_recipients srt
           JOIN teams t ON srt.team_id = t.id
           WHERE srt.scheduled_report_id = sr.id),
          '[]'::json
        ) AS team_recipients
      FROM scheduled_reports sr
      LEFT JOIN users u ON sr.created_by = u.id
      WHERE sr.tenant_id = $1
      GROUP BY sr.id, u.first_name, u.last_name
      ORDER BY sr.created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  static async findById(id, tenantId) {
    const result = await db.query(
      `SELECT sr.*,
        u.first_name || ' ' || u.last_name AS created_by_name,
        COALESCE(
          (SELECT json_agg(json_build_object('user_id', srr.user_id, 'first_name', ru.first_name, 'last_name', ru.last_name, 'email', ru.email))
           FROM scheduled_report_recipients srr
           JOIN users ru ON srr.user_id = ru.id
           WHERE srr.scheduled_report_id = sr.id),
          '[]'::json
        ) AS recipients,
        COALESCE(
          (SELECT json_agg(json_build_object('team_id', srt.team_id, 'name', t.name, 'color', t.color))
           FROM scheduled_report_team_recipients srt
           JOIN teams t ON srt.team_id = t.id
           WHERE srt.scheduled_report_id = sr.id),
          '[]'::json
        ) AS team_recipients
      FROM scheduled_reports sr
      LEFT JOIN users u ON sr.created_by = u.id
      WHERE sr.id = $1 AND sr.tenant_id = $2
      GROUP BY sr.id, u.first_name, u.last_name`,
      [id, tenantId]
    );
    return result.rows[0] || null;
  }

  static async create(data, tenantId) {
    const {
      name, report_type, frequency, day_of_week, day_of_month,
      time_of_day, timezone, filters, is_enabled, created_by,
      recipient_user_ids, recipient_team_ids,
    } = data;

    const nextRun = ScheduledReport.computeNextRun(
      frequency, day_of_week, day_of_month, time_of_day || '08:00', timezone || 'America/Chicago'
    );

    const result = await db.query(
      `INSERT INTO scheduled_reports
        (tenant_id, name, report_type, frequency, day_of_week, day_of_month,
         time_of_day, timezone, filters, is_enabled, next_run_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        tenantId, name, report_type, frequency,
        day_of_week ?? null, day_of_month ?? null,
        time_of_day || '08:00', timezone || 'America/Chicago',
        JSON.stringify(filters || {}),
        is_enabled !== false, nextRun, created_by,
      ]
    );

    const report = result.rows[0];

    // Insert user recipients
    if (recipient_user_ids && recipient_user_ids.length > 0) {
      const values = recipient_user_ids.map((uid, i) =>
        `($1, $${i + 2})`
      ).join(', ');
      await db.query(
        `INSERT INTO scheduled_report_recipients (scheduled_report_id, user_id) VALUES ${values}`,
        [report.id, ...recipient_user_ids]
      );
    }

    // Insert team recipients
    if (recipient_team_ids && recipient_team_ids.length > 0) {
      const values = recipient_team_ids.map((tid, i) =>
        `($1, $${i + 2})`
      ).join(', ');
      await db.query(
        `INSERT INTO scheduled_report_team_recipients (scheduled_report_id, team_id) VALUES ${values}`,
        [report.id, ...recipient_team_ids]
      );
    }

    return ScheduledReport.findById(report.id, tenantId);
  }

  static async update(id, data, tenantId) {
    const existing = await db.query(
      'SELECT * FROM scheduled_reports WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (existing.rows.length === 0) return null;

    const {
      name, report_type, frequency, day_of_week, day_of_month,
      time_of_day, timezone, filters, is_enabled,
      recipient_user_ids, recipient_team_ids,
    } = data;

    const freq = frequency || existing.rows[0].frequency;
    const dow = day_of_week !== undefined ? day_of_week : existing.rows[0].day_of_week;
    const dom = day_of_month !== undefined ? day_of_month : existing.rows[0].day_of_month;
    const tod = time_of_day || existing.rows[0].time_of_day;
    const tz = timezone || existing.rows[0].timezone;

    const nextRun = ScheduledReport.computeNextRun(freq, dow, dom, tod, tz);

    await db.query(
      `UPDATE scheduled_reports SET
        name = COALESCE($3, name),
        report_type = COALESCE($4, report_type),
        frequency = COALESCE($5, frequency),
        day_of_week = $6,
        day_of_month = $7,
        time_of_day = COALESCE($8, time_of_day),
        timezone = COALESCE($9, timezone),
        filters = COALESCE($10, filters),
        is_enabled = COALESCE($11, is_enabled),
        next_run_at = $12,
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2`,
      [
        id, tenantId, name, report_type, frequency,
        dow, dom, tod, tz,
        filters ? JSON.stringify(filters) : null,
        is_enabled, nextRun,
      ]
    );

    // Sync user recipients if provided
    if (recipient_user_ids !== undefined) {
      await db.query(
        'DELETE FROM scheduled_report_recipients WHERE scheduled_report_id = $1',
        [id]
      );
      if (recipient_user_ids.length > 0) {
        const values = recipient_user_ids.map((uid, i) =>
          `($1, $${i + 2})`
        ).join(', ');
        await db.query(
          `INSERT INTO scheduled_report_recipients (scheduled_report_id, user_id) VALUES ${values}`,
          [id, ...recipient_user_ids]
        );
      }
    }

    // Sync team recipients if provided
    if (recipient_team_ids !== undefined) {
      await db.query(
        'DELETE FROM scheduled_report_team_recipients WHERE scheduled_report_id = $1',
        [id]
      );
      if (recipient_team_ids.length > 0) {
        const values = recipient_team_ids.map((tid, i) =>
          `($1, $${i + 2})`
        ).join(', ');
        await db.query(
          `INSERT INTO scheduled_report_team_recipients (scheduled_report_id, team_id) VALUES ${values}`,
          [id, ...recipient_team_ids]
        );
      }
    }

    return ScheduledReport.findById(id, tenantId);
  }

  static async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM scheduled_reports WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    return result.rows.length > 0;
  }

  /**
   * Find all reports that are due to run (across all tenants).
   * Used by the cron job runner.
   */
  static async findDueReports() {
    const result = await db.query(
      `SELECT sr.*,
        COALESCE(
          (SELECT json_agg(json_build_object('user_id', srr.user_id, 'email', u.email, 'first_name', u.first_name, 'last_name', u.last_name))
           FROM scheduled_report_recipients srr
           JOIN users u ON srr.user_id = u.id
           WHERE srr.scheduled_report_id = sr.id),
          '[]'::json
        ) AS recipients,
        COALESCE(
          (SELECT json_agg(json_build_object('team_id', srt.team_id))
           FROM scheduled_report_team_recipients srt
           WHERE srt.scheduled_report_id = sr.id),
          '[]'::json
        ) AS team_recipients
      FROM scheduled_reports sr
      WHERE sr.is_enabled = true AND sr.next_run_at <= NOW()
      GROUP BY sr.id`
    );
    return result.rows;
  }

  /**
   * Mark a report as having just run, and compute the next run time.
   */
  static async markRun(id) {
    const report = await db.query('SELECT * FROM scheduled_reports WHERE id = $1', [id]);
    if (report.rows.length === 0) return;

    const r = report.rows[0];
    const nextRun = ScheduledReport.computeNextRun(
      r.frequency, r.day_of_week, r.day_of_month,
      r.time_of_day, r.timezone
    );

    await db.query(
      `UPDATE scheduled_reports SET last_run_at = NOW(), next_run_at = $2, updated_at = NOW() WHERE id = $1`,
      [id, nextRun]
    );
  }
}

module.exports = ScheduledReport;
