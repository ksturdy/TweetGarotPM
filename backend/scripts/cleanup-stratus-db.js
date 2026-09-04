/**
 * One-time cleanup: delete duplicate stratus imports (keep latest per project),
 * null out the raw JSONB column on remaining rows, then vacuum.
 *
 * Run AFTER expanding Render disk storage:
 *   node backend/scripts/cleanup-stratus-db.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('Finding latest import per project...');
  const keepers = await pool.query(`
    SELECT DISTINCT ON (project_id) id, project_id, filename, row_count, snapshot_at
    FROM stratus_imports
    ORDER BY project_id, snapshot_at DESC
  `);
  const keepIds = keepers.rows.map((r) => r.id);
  console.log('Keeping import IDs:', keepIds);
  keepers.rows.forEach((r) =>
    console.log(`  import ${r.id}: project ${r.project_id} — ${r.filename} (${r.row_count} rows, ${r.snapshot_at})`)
  );

  console.log('\nDeleting duplicate stratus_imports (parts cascade)...');
  const del = await pool.query(
    'DELETE FROM stratus_imports WHERE id != ALL($1)',
    [keepIds]
  );
  console.log(`Deleted ${del.rowCount} import records (and their parts via cascade).`);

  console.log('\nNulling raw JSONB column on remaining stratus_parts...');
  const nulled = await pool.query('UPDATE stratus_parts SET raw = NULL WHERE raw IS NOT NULL');
  console.log(`Nulled raw on ${nulled.rowCount} rows.`);

  console.log('\nRunning VACUUM ANALYZE...');
  await pool.query('VACUUM ANALYZE stratus_parts');
  await pool.query('VACUUM ANALYZE stratus_imports');
  console.log('Done.');

  const size = await pool.query(`
    SELECT pg_size_pretty(pg_total_relation_size('stratus_parts')) AS parts_size,
           pg_size_pretty(pg_total_relation_size('stratus_imports')) AS imports_size
  `);
  console.log('\nPost-cleanup sizes:', size.rows[0]);
}

run().then(() => pool.end()).catch((e) => { console.error(e.message); pool.end(); process.exit(1); });
