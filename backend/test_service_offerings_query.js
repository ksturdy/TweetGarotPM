const db = require('./src/config/database');

(async () => {
  try {
    console.log('Testing service offerings query...\n');

    const query = `
      SELECT *
      FROM service_offerings
      WHERE tenant_id = $1
      ORDER BY display_order NULLS LAST, name ASC
    `;

    const result = await db.query(query, [1]);

    console.log('✅ Query successful!');
    console.log(`Found ${result.rows.length} service offerings`);
    console.log('\nFirst 3 offerings:');
    result.rows.slice(0, 3).forEach(row => {
      console.log(`  - ${row.name} (${row.category})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  }
})();
