require('dotenv').config();
const db = require('../src/config/database');
(async () => {
  // Only kill SELECT queries (read-only) that match the cost database pattern.
  const r = await db.query(`
    SELECT pid, EXTRACT(EPOCH FROM (now() - query_start))::int AS seconds_running
    FROM pg_stat_activity
    WHERE state = 'active'
      AND pid <> pg_backend_pid()
      AND query ILIKE '%filtered_projects%'
  `);
  console.log(`Found ${r.rows.length} stuck Cost Database queries.`);
  for (const row of r.rows) {
    try {
      await db.query(`SELECT pg_terminate_backend($1)`, [row.pid]);
      console.log(`  Terminated pid=${row.pid} (was running ${row.seconds_running}s)`);
    } catch (e) {
      console.error(`  Failed to terminate pid=${row.pid}: ${e.message}`);
    }
  }
  const after = await db.query(`SELECT COUNT(*)::int AS n FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid()`);
  console.log(`\nRemaining active queries: ${after.rows[0].n}`);
  process.exit(0);
})();
