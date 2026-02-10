require('dotenv').config();
const db = require('../src/config/database');

async function run() {
  // Check customers table structure
  const custCols = await db.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'customers'
    ORDER BY column_name
  `);
  console.log('All columns in customers table:');
  custCols.rows.forEach(r => console.log('  -', r.column_name, '(' + r.data_type + ')'));

  // Check vp_work_orders columns
  const woCols = await db.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'vp_work_orders'
    ORDER BY column_name
  `);
  console.log('\nAll columns in vp_work_orders table:');
  woCols.rows.forEach(r => console.log('  -', r.column_name, '(' + r.data_type + ')'));

  process.exit(0);
}
run();
