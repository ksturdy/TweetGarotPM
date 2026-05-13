// One-off: re-parse already-stored GC schedule versions using the current
// PDF parser logic. Reads each row's raw.line, runs it through parsePdfLines,
// then replaces the activities for that version inside a transaction.
//
// Usage:  node src/scripts/reparseGcPdfVersions.js <versionId> [<versionId>...]
//         node src/scripts/reparseGcPdfVersions.js --dry-run <versionId> [...]
//
// Requires DATABASE_URL (via dotenv .env) — runs against whichever DB the
// backend normally talks to.

require('dotenv').config();
const db = require('../config/database');
const GCSchedule = require('../models/GCSchedule');
const { parsePdfLines, applyTradeDetection } = require('../utils/gcScheduleImporter');

async function reparseVersion(versionId, { dryRun }) {
  const v = await db.query(
    `SELECT id, tenant_id, project_id, source_format, source_filename, activity_count
       FROM gc_schedule_versions WHERE id = $1`,
    [versionId]
  );
  if (!v.rowCount) {
    console.log(`  version ${versionId}: NOT FOUND`);
    return;
  }
  const version = v.rows[0];
  if (version.source_format !== 'pdf') {
    console.log(`  version ${versionId}: skipping (format=${version.source_format}, only pdf is supported)`);
    return;
  }

  const rows = await db.query(
    `SELECT raw FROM gc_schedule_activities
       WHERE version_id = $1
       ORDER BY display_order, id`,
    [versionId]
  );
  const lines = rows.rows
    .map((r) => (r.raw && r.raw.line) ? String(r.raw.line) : null)
    .filter(Boolean);

  if (!lines.length) {
    console.log(`  version ${versionId}: no raw.line values stored — cannot re-parse without original PDF`);
    return;
  }

  const parsed = parsePdfLines(lines);
  const rules = await GCSchedule.getTradeRules({ tenantId: version.tenant_id });
  applyTradeDetection(parsed.activities, rules);

  // Backfill duration_days the same way parseGCSchedule does.
  for (const a of parsed.activities) {
    if (a.duration_days == null && a.start_date && a.finish_date) {
      const ms = new Date(a.finish_date + 'T00:00:00').getTime()
              - new Date(a.start_date + 'T00:00:00').getTime();
      if (!Number.isNaN(ms) && ms >= 0) a.duration_days = Math.round(ms / 86400000);
    }
  }

  const taskCount = parsed.activities.filter((a) => !a.is_summary).length;
  const summaryCount = parsed.activities.filter((a) => a.is_summary).length;
  const mechCount = parsed.activities.filter((a) => a.is_mechanical).length;
  console.log(
    `  version ${versionId} (${version.source_filename}): ` +
    `parsed ${parsed.activities.length} rows (tasks=${taskCount}, summaries=${summaryCount}, mech=${mechCount}) ` +
    `[was: ${version.activity_count}]`
  );

  if (dryRun) {
    console.log('    --dry-run: not writing.');
    return;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM gc_schedule_activities WHERE version_id = $1', [versionId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    throw err;
  } finally {
    client.release();
  }

  await GCSchedule.bulkInsertActivities({ versionId, activities: parsed.activities });
  await GCSchedule.finalizeVersion(versionId, {
    activityCount: parsed.activities.length,
    parseStatus: 'completed',
  });
  console.log(`    wrote ${parsed.activities.length} activities.`);
}

(async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const ids = args.filter((a) => /^\d+$/.test(a)).map(Number);
  if (!ids.length) {
    console.error('Usage: node src/scripts/reparseGcPdfVersions.js [--dry-run] <versionId> [<versionId>...]');
    process.exit(1);
  }

  console.log(`Re-parsing ${ids.length} version(s)${dryRun ? ' (DRY RUN)' : ''}: ${ids.join(', ')}`);
  for (const id of ids) {
    try {
      await reparseVersion(id, { dryRun });
    } catch (err) {
      console.error(`  version ${id}: FAILED —`, err.message);
    }
  }
  process.exit(0);
})();
