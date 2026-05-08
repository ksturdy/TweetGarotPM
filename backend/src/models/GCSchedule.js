const db = require('../config/database');

const ACTIVITY_COLUMNS = [
  'activity_id', 'activity_name', 'wbs_code', 'wbs_path',
  'start_date', 'finish_date', 'baseline_start', 'baseline_finish',
  'duration_days', 'percent_complete', 'status',
  'predecessors', 'successors', 'responsible',
  'trade', 'is_mechanical', 'is_milestone', 'is_summary',
  'raw', 'display_order',
];

const GCSchedule = {
  async createVersion({ tenantId, projectId, versionLabel, scheduleDate, sourceFilename, sourceFormat, notes, uploadedBy }) {
    const result = await db.query(
      `INSERT INTO gc_schedule_versions
         (tenant_id, project_id, version_label, schedule_date, source_filename, source_format, notes, uploaded_by, parse_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'parsing')
       RETURNING *`,
      [tenantId, projectId, versionLabel || null, scheduleDate || null, sourceFilename || null, sourceFormat, notes || null, uploadedBy || null]
    );
    return result.rows[0];
  },

  async finalizeVersion(versionId, { activityCount, parseStatus, parseError }) {
    const result = await db.query(
      `UPDATE gc_schedule_versions
         SET activity_count = $1, parse_status = $2, parse_error = $3
       WHERE id = $4
       RETURNING *`,
      [activityCount || 0, parseStatus, parseError || null, versionId]
    );
    return result.rows[0];
  },

  async listVersions({ projectId, tenantId }) {
    const result = await db.query(
      `SELECT v.*, u.first_name || ' ' || u.last_name AS uploaded_by_name
       FROM gc_schedule_versions v
       LEFT JOIN users u ON v.uploaded_by = u.id
       WHERE v.tenant_id = $1 AND v.project_id = $2
       ORDER BY v.uploaded_at DESC`,
      [tenantId, projectId]
    );
    return result.rows;
  },

  async getVersion({ versionId, tenantId }) {
    const result = await db.query(
      `SELECT v.*, u.first_name || ' ' || u.last_name AS uploaded_by_name
       FROM gc_schedule_versions v
       LEFT JOIN users u ON v.uploaded_by = u.id
       WHERE v.id = $1 AND v.tenant_id = $2`,
      [versionId, tenantId]
    );
    return result.rows[0] || null;
  },

  async deleteVersion({ versionId, tenantId }) {
    const result = await db.query(
      `DELETE FROM gc_schedule_versions WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [versionId, tenantId]
    );
    return result.rowCount > 0;
  },

  async bulkInsertActivities({ versionId, activities }) {
    if (!activities.length) return 0;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const baseCols = ['version_id', ...ACTIVITY_COLUMNS];
      const chunkSize = 500;
      let inserted = 0;
      for (let i = 0; i < activities.length; i += chunkSize) {
        const chunk = activities.slice(i, i + chunkSize);
        const values = [];
        const placeholders = chunk.map((a, rowIdx) => {
          const row = [versionId, ...ACTIVITY_COLUMNS.map((c) => {
            if (c === 'raw') return a.raw ? JSON.stringify(a.raw) : null;
            return a[c] === undefined ? null : a[c];
          })];
          const start = rowIdx * baseCols.length;
          values.push(...row);
          return '(' + baseCols.map((_, j) => `$${start + j + 1}`).join(',') + ')';
        });
        const sql = `INSERT INTO gc_schedule_activities (${baseCols.join(',')}) VALUES ${placeholders.join(',')}`;
        await client.query(sql, values);
        inserted += chunk.length;
      }
      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async listActivities({ versionId, filters = {} }) {
    const conditions = ['version_id = $1'];
    const params = [versionId];
    let p = 2;

    if (filters.mechanicalOnly === true || filters.mechanicalOnly === 'true') {
      conditions.push('is_mechanical = TRUE');
    }
    if (filters.trade) {
      conditions.push(`trade = $${p++}`);
      params.push(filters.trade);
    }
    if (filters.search) {
      conditions.push(`(activity_name ILIKE $${p} OR activity_id ILIKE $${p} OR wbs_code ILIKE $${p} OR responsible ILIKE $${p})`);
      params.push(`%${filters.search}%`);
      p++;
    }
    if (filters.startAfter) {
      conditions.push(`finish_date >= $${p++}`);
      params.push(filters.startAfter);
    }
    if (filters.endBefore) {
      conditions.push(`start_date <= $${p++}`);
      params.push(filters.endBefore);
    }
    if (filters.hideSummary) {
      conditions.push('is_summary = FALSE');
    }

    const where = conditions.join(' AND ');
    const result = await db.query(
      `SELECT * FROM gc_schedule_activities
       WHERE ${where}
       ORDER BY display_order, id`,
      params
    );
    return result.rows;
  },

  async setMechanicalOverride({ activityId, isMechanical }) {
    const result = await db.query(
      `UPDATE gc_schedule_activities
         SET is_mechanical = $1, mechanical_override = TRUE
       WHERE id = $2
       RETURNING *`,
      [!!isMechanical, activityId]
    );
    return result.rows[0];
  },

  async getTradeRules({ tenantId }) {
    const result = await db.query(
      `SELECT id, tenant_id, trade, keyword, match_field, is_active
       FROM gc_schedule_trade_rules
       WHERE is_active = TRUE AND (tenant_id IS NULL OR tenant_id = $1)
       ORDER BY trade, keyword`,
      [tenantId]
    );
    return result.rows;
  },

  // Diff two versions of the same project's schedule. Returns arrays of
  // added (only in B), removed (only in A), and changed (in both, but
  // start/finish/duration/percent_complete or name differ). Match key is
  // activity_id; rows without an activity_id are skipped from the diff.
  //
  // Each date/numeric diff is annotated with direction + magnitude so the
  // UI can render "pushed back 7 days" instead of just two ISO strings.
  // We also suppress noise diffs:
  //   • name diffs where the only difference is trailing P6 column residue
  //     (e.g. "Steel Submittals (3 weeks)" vs "Steel Submittals (3 weeks) 0 A")
  //   • duration diffs that are pure backfills — one side was null while the
  //     start/finish on both sides match (the duration was just computed
  //     after-the-fact and isn't a real schedule change)
  async diffVersions({ versionAId, versionBId }) {
    const aRows = await db.query(
      `SELECT activity_id, activity_name, start_date, finish_date,
              duration_days, percent_complete, is_mechanical, wbs_code
       FROM gc_schedule_activities
       WHERE version_id = $1 AND activity_id IS NOT NULL`,
      [versionAId]
    );
    const bRows = await db.query(
      `SELECT activity_id, activity_name, start_date, finish_date,
              duration_days, percent_complete, is_mechanical, wbs_code
       FROM gc_schedule_activities
       WHERE version_id = $1 AND activity_id IS NOT NULL`,
      [versionBId]
    );

    const aMap = new Map(aRows.rows.map((r) => [r.activity_id, r]));
    const bMap = new Map(bRows.rows.map((r) => [r.activity_id, r]));

    const normalizeName = (s) => String(s || '')
      .replace(/\s+[\dA*\.\-]+(?:\s+[A*])*\s*$/, '') // strip trailing P6 residue: " 0 A", " -3", " 0 *"
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    // Postgres returns DATE columns as JS Date objects (not strings), so
    // pass through new Date() directly — String() on a Date produces a
    // locale string that won't reparse, which would silently null the delta.
    const dayDiff = (from, to) => {
      if (from == null || to == null) return null;
      const fa = new Date(from).getTime();
      const fb = new Date(to).getTime();
      if (Number.isNaN(fa) || Number.isNaN(fb)) return null;
      return Math.round((fb - fa) / 86400000);
    };

    // Effective duration: prefer the stored value, but fall back to
    // (finish - start) so old uploads with null duration_days still
    // produce a meaningful delta when dates are present on both sides.
    const effectiveDuration = (row) => {
      if (row.duration_days != null) return Number(row.duration_days);
      const d = dayDiff(row.start_date, row.finish_date);
      return d != null && d >= 0 ? d : null;
    };

    const added = [];
    const removed = [];
    const changed = [];

    for (const [aid, b] of bMap) {
      const a = aMap.get(aid);
      if (!a) {
        added.push(b);
      } else {
        const diffs = {};

        // Name — only flag real semantic changes (ignore PDF cleanup residue)
        if (normalizeName(a.activity_name) !== normalizeName(b.activity_name)) {
          diffs.name = { from: a.activity_name, to: b.activity_name };
        }

        // Start date — earlier (-) or delayed (+) by N days
        const startA = a.start_date ? new Date(a.start_date).toISOString().slice(0, 10) : null;
        const startB = b.start_date ? new Date(b.start_date).toISOString().slice(0, 10) : null;
        if (startA !== startB) {
          diffs.start = { from: a.start_date, to: b.start_date, deltaDays: dayDiff(a.start_date, b.start_date) };
        }

        // Finish date
        const finA = a.finish_date ? new Date(a.finish_date).toISOString().slice(0, 10) : null;
        const finB = b.finish_date ? new Date(b.finish_date).toISOString().slice(0, 10) : null;
        if (finA !== finB) {
          diffs.finish = { from: a.finish_date, to: b.finish_date, deltaDays: dayDiff(a.finish_date, b.finish_date) };
        }

        // Duration — compare effective durations (stored OR start→finish derived)
        // so rows uploaded before the duration-backfill don't show phantom
        // "Set (- → N days)" diffs. Real change = real change.
        const durA = effectiveDuration(a);
        const durB = effectiveDuration(b);
        if (durA !== durB) {
          diffs.duration = {
            from: durA, to: durB,
            deltaDays: durA != null && durB != null ? +(durB - durA).toFixed(2) : null,
          };
        }

        // Percent complete
        const pctA = a.percent_complete != null ? Number(a.percent_complete) : null;
        const pctB = b.percent_complete != null ? Number(b.percent_complete) : null;
        if (pctA !== pctB) {
          diffs.percent = { from: pctA, to: pctB, deltaPoints: pctA != null && pctB != null ? +(pctB - pctA).toFixed(2) : null };
        }

        if (Object.keys(diffs).length) {
          changed.push({ activity_id: aid, name: b.activity_name, is_mechanical: b.is_mechanical, wbs_code: b.wbs_code, diffs });
        }
      }
    }
    for (const [aid, a] of aMap) {
      if (!bMap.has(aid)) removed.push(a);
    }

    return { added, removed, changed };
  },
};

module.exports = GCSchedule;
