require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

async function run() {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'migrations', '219_optimize_phase_codes_indexes.sql'),
    'utf8'
  );
  console.log('Creating indexes (this may take 30-90 seconds on 181K rows)...');
  const start = Date.now();
  await db.query(sql);
  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
