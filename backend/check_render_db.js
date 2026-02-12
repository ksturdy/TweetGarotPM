require('dotenv').config();
const db = require('./src/config/database');

(async () => {
  try {
    const dbInfo = await db.query('SELECT current_database()');
    console.log('Connected to database:', dbInfo.rows[0].current_database);

    const count = await db.query('SELECT COUNT(*) as count FROM service_offerings');
    console.log('Current service offerings count:', count.rows[0].count);

    if (parseInt(count.rows[0].count) > 0) {
      console.log('\nClearing existing service offerings...');
      await db.query('DELETE FROM service_offerings');
      console.log('✅ Cleared all service offerings');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
