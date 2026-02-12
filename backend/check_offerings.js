const db = require('./src/config/database');

(async () => {
  try {
    // Check if table exists
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'service_offerings'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ service_offerings table does not exist');
      process.exit(1);
    }
    
    console.log('✅ service_offerings table exists\n');
    
    // Count all offerings
    const countResult = await db.query('SELECT COUNT(*) as count FROM service_offerings');
    console.log(`Total service offerings: ${countResult.rows[0].count}`);
    
    // Check by tenant
    const tenantResult = await db.query(`
      SELECT tenant_id, COUNT(*) as count 
      FROM service_offerings 
      GROUP BY tenant_id
      ORDER BY tenant_id
    `);
    
    console.log('\nBy tenant:');
    tenantResult.rows.forEach(row => {
      console.log(`  Tenant ${row.tenant_id}: ${row.count} offerings`);
    });
    
    // Show first few
    const sampleResult = await db.query('SELECT id, name, category, tenant_id FROM service_offerings LIMIT 5');
    console.log('\nFirst 5 offerings:');
    sampleResult.rows.forEach(row => {
      console.log(`  [${row.id}] ${row.name} (${row.category}) - Tenant ${row.tenant_id}`);
    });
    
    process.exit(0);
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
