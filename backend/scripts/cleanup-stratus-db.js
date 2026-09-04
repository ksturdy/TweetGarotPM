/**
 * Emergency space recovery for a full Render PostgreSQL instance.
 *
 * Strategy: TRUNCATE stratus_parts (minimal WAL — no row-by-row logging)
 * to immediately free ~440 MB, then delete the now-orphan import records.
 * stratus_production_snapshots is preserved (import_id becomes NULL).
 *
 * After running this script, re-upload each project's Stratus file once
 * through the Stratus module in the UI to restore the parts data.
 *
 * Run from the project root:
 *   node backend/scripts/cleanup-stratus-db.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('Checking current sizes...');
  const before = await pool.query(`
    SELECT
      pg_size_pretty(pg_total_relation_size('stratus_parts'))   AS parts_size,
      pg_size_pretty(pg_total_relation_size('stratus_imports'))  AS imports_size,
      (SELECT COUNT(*) FROM stratus_parts)                       AS parts_rows,
      (SELECT COUNT(*) FROM stratus_imports)                     AS import_count,
      (SELECT COUNT(*) FROM stratus_production_snapshots)        AS snapshot_count
  `);
  console.log('Before:', before.rows[0]);

  // TRUNCATE uses a single tiny WAL record regardless of table size.
  // It also immediately makes space available — no VACUUM needed.
  // The FK from stratus_production_snapshots uses ON DELETE SET NULL,
  // but TRUNCATE CASCADE would wipe snapshots, so we truncate only
  // stratus_parts (no outbound FKs — safe to truncate standalone).
  console.log('\nTruncating stratus_parts...');
  await pool.query('TRUNCATE TABLE stratus_parts RESTART IDENTITY');
  console.log('stratus_parts truncated.');

  // With parts gone, deleting import records is now trivially small WAL
  console.log('Deleting all stratus_import records...');
  const del = await pool.query('DELETE FROM stratus_imports');
  console.log(`Deleted ${del.rowCount} import records.`);

  // Null out import_id on production snapshots (they're still valuable —
  // weld inches and JTD hours are stored directly on each snapshot row)
  console.log('Nulling import_id on production snapshots...');
  const snap = await pool.query('UPDATE stratus_production_snapshots SET import_id = NULL WHERE import_id IS NOT NULL');
  console.log(`Updated ${snap.rowCount} snapshot rows.`);

  console.log('\nRunning VACUUM ANALYZE...');
  await pool.query('VACUUM ANALYZE stratus_parts');
  await pool.query('VACUUM ANALYZE stratus_imports');
  console.log('Done.');

  const after = await pool.query(`
    SELECT
      pg_size_pretty(pg_total_relation_size('stratus_parts'))   AS parts_size,
      pg_size_pretty(pg_database_size(current_database()))      AS total_db_size
  `);
  console.log('\nAfter:', after.rows[0]);
  console.log('\nNext step: re-upload each project\'s Stratus file through the UI.');
}

run().then(() => pool.end()).catch((e) => {
  console.error('FAILED:', e.message);
  pool.end();
  process.exit(1);
});
