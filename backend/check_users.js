const db = require('./src/config/database');

(async () => {
  try {
    const res = await db.query('SELECT id, email, role, tenant_id FROM users ORDER BY id LIMIT 20');
    console.log('\nUsers in database:');
    res.rows.forEach(u => {
      console.log(`  ${u.email} (role: ${u.role}, tenant: ${u.tenant_id})`);
    });
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
