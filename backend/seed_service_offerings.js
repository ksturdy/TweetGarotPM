require('dotenv').config(); // Load environment variables from .env
const db = require('./src/config/database');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log('Seeding service offerings...\n');

    const seedFile = path.join(__dirname, 'src/migrations/seeds/078_seed_service_offerings.sql');
    const sql = fs.readFileSync(seedFile, 'utf8');

    // Remove comments and split by semicolons
    const statements = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      if (statement.includes('INSERT INTO') || statement.includes('COMMENT ON')) {
        await db.query(statement);
      }
    }

    console.log('✅ Service offerings seeded successfully!');

    // Count the results
    const result = await db.query(
      'SELECT COUNT(*) as count FROM service_offerings WHERE tenant_id = 1'
    );
    console.log(`   Total service offerings: ${result.rows[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding service offerings:', error.message);
    process.exit(1);
  }
})();
