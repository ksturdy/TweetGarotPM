require('dotenv').config();
const db = require('../src/config/database');

async function run() {
  const sample = await db.query(`
    SELECT c.id, c.customer_owner, c.customer_facility,
      (SELECT COUNT(*) FROM vp_work_orders WHERE linked_customer_id = c.id) as work_orders,
      (SELECT COUNT(*) FROM projects WHERE customer_id = c.id) as projects,
      (SELECT COUNT(*) FROM estimates WHERE customer_id = c.id) as estimates
    FROM customers c
    WHERE EXISTS (SELECT 1 FROM vp_work_orders WHERE linked_customer_id = c.id)
       OR EXISTS (SELECT 1 FROM projects WHERE customer_id = c.id)
    ORDER BY (SELECT COUNT(*) FROM vp_work_orders WHERE linked_customer_id = c.id) DESC
    LIMIT 5
  `);
  console.log('Sample customers with linked data:');
  sample.rows.forEach(r => console.log(`  ID: ${r.id} | ${r.customer_owner} | WOs: ${r.work_orders} | Projects: ${r.projects} | Estimates: ${r.estimates}`));
  process.exit(0);
}
run();
