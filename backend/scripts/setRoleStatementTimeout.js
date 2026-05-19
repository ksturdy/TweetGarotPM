// Set a default statement_timeout on the app's DB role as a safety net.
// New connections inherit this; existing connections keep their previous
// setting until they're recycled. The per-query SET LOCAL in the new
// CostDatabase model still applies its own (tighter) 20s timeout.
require('dotenv').config();
const db = require('../src/config/database');
(async () => {
  const cur = await db.query('SELECT current_user');
  const user = cur.rows[0].current_user;
  console.log(`Current DB user: ${user}`);
  const before = await db.query(
    `SELECT rolconfig FROM pg_roles WHERE rolname = $1`, [user]
  );
  console.log('Current rolconfig:', before.rows[0]?.rolconfig);

  await db.query(`ALTER ROLE ${user} SET statement_timeout = '60s'`);
  console.log("Set statement_timeout = '60s' for role.");

  const after = await db.query(
    `SELECT rolconfig FROM pg_roles WHERE rolname = $1`, [user]
  );
  console.log('New rolconfig:', after.rows[0]?.rolconfig);
  process.exit(0);
})();
