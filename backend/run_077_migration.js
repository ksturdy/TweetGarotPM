const db = require('./src/config/database');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log('Running migration 077...\n');

    const migrationFile = path.join(__dirname, 'src/migrations/077_create_service_offerings.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    await db.query(sql);

    console.log('✅ Migration 077 completed successfully!');

    // Verify table exists
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'service_offerings'
    `);

    if (result.rows.length > 0) {
      console.log('✅ service_offerings table created');
    } else {
      console.log('❌ service_offerings table not found');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
