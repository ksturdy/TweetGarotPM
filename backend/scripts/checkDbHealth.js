require('dotenv').config();
const db = require('../src/config/database');
(async () => {
  try {
    const start = Date.now();
    const r = await db.query('SELECT 1 AS ok');
    console.log(`DB responds in ${Date.now() - start}ms:`, r.rows[0]);

    // Active queries other than this one
    const active = await db.query(`
      SELECT pid, state, wait_event_type, wait_event,
             EXTRACT(EPOCH FROM (now() - query_start))::int AS seconds_running,
             LEFT(query, 200) AS query
      FROM pg_stat_activity
      WHERE state <> 'idle' AND pid <> pg_backend_pid()
      ORDER BY query_start ASC
    `);
    console.log(`\nActive (non-idle) queries: ${active.rows.length}`);
    active.rows.forEach(q => {
      console.log(`  pid=${q.pid} state=${q.state} wait=${q.wait_event_type}/${q.wait_event} ${q.seconds_running}s`);
      console.log(`    ${q.query.replace(/\s+/g, ' ').slice(0, 180)}`);
    });

    // Connection count
    const conns = await db.query(`SELECT COUNT(*)::int AS n FROM pg_stat_activity`);
    console.log(`\nTotal connections: ${conns.rows[0].n}`);

    // Blocked queries
    const blocked = await db.query(`
      SELECT pid, EXTRACT(EPOCH FROM (now() - query_start))::int AS s, LEFT(query, 120) AS q
      FROM pg_stat_activity
      WHERE wait_event_type = 'Lock' AND pid <> pg_backend_pid()
    `);
    console.log(`Blocked-on-lock queries: ${blocked.rows.length}`);
    blocked.rows.forEach(q => console.log(`  pid=${q.pid} ${q.s}s ${q.q}`));

    process.exit(0);
  } catch (e) {
    console.error('DB check failed:', e.message);
    process.exit(1);
  }
})();
