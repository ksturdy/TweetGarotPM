require('dotenv').config();
const db = require('../src/config/database');
(async () => {
  const r = await db.query(
    `SELECT id, email, first_name || ' ' || last_name AS name, role
     FROM users WHERE tenant_id = 1 AND role = 'admin' ORDER BY id LIMIT 10`
  );
  console.log('Admins (tenant 1):');
  r.rows.forEach(u => console.log(`  id=${u.id}  ${u.email}  (${u.name})`));
  const kipp = await db.query(
    `SELECT id, email, first_name || ' ' || last_name AS name FROM users WHERE email = $1`,
    ['kipp.sturdivant@tweetgarot.com']
  );
  console.log('\nKipp:');
  kipp.rows.forEach(u => console.log(`  id=${u.id}  ${u.email}  (${u.name})`));
  process.exit(0);
})();
