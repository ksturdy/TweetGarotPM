const db = require('./src/config/database');

(async () => {
  try {
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%service%'
    `);
    
    console.log('Tables with "service" in name:');
    result.rows.forEach(row => console.log('  -', row.table_name));
    
    if (result.rows.length === 0) {
      console.log('  (none found)');
      console.log('\nLet me check all tables:');
      const allTables = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      console.log(`Found ${allTables.rows.length} tables total`);
    }
    
    process.exit(0);
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
