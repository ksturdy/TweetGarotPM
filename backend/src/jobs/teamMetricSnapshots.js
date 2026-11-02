const db = require('../config/database');
const Team = require('../models/Team');

/**
 * Capture team metric snapshots for all teams whose configured day+hour matches now.
 * Runs every hour via cron. Skips teams that already have a snapshot for the current week.
 */
async function captureTeamMetricSnapshots() {
  const now = new Date();
  const dowNow = now.getDay();   // 0=Sun, 1=Mon, ..., 6=Sat (matches PG DOW)
  const hourNow = now.getHours();

  // Teams that have metric configs AND are scheduled for this day+hour
  const r = await db.query(`
    SELECT DISTINCT tmc.team_id, tmc.tenant_id
    FROM team_metric_configs tmc
    JOIN team_metric_settings tms ON tms.team_id = tmc.team_id
    WHERE tms.snapshot_day_of_week = $1
      AND tms.snapshot_hour = $2
  `, [dowNow, hourNow]);

  if (r.rows.length === 0) return;

  const wsRow = await db.query(`SELECT DATE_TRUNC('week', NOW())::DATE AS ws`);
  const weekStart = wsRow.rows[0].ws;

  let captured = 0;
  for (const { team_id, tenant_id } of r.rows) {
    // Skip if already snapshotted this week
    const existing = await db.query(`
      SELECT 1 FROM team_metric_snapshots
      WHERE team_id = $1 AND tenant_id = $2 AND week_start = $3
      LIMIT 1
    `, [team_id, tenant_id, weekStart]);

    if (existing.rows.length > 0) continue;

    try {
      await Team.captureMetricSnapshot(team_id, tenant_id);
      captured++;
    } catch (err) {
      console.error(`[TeamMetrics] Snapshot failed for team ${team_id}:`, err.message);
    }
  }

  if (captured > 0) {
    console.log(`[TeamMetrics] Auto-snapshot complete: ${captured} team(s) captured`);
  }
}

module.exports = { captureTeamMetricSnapshots };
