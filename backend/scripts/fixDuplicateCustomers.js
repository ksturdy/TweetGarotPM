require('dotenv').config();
const db = require('../src/config/database');

async function fixDuplicates() {
  try {
    // Update customer_facility to include city for records where the owner has multiple locations
    const result = await db.query(`
      UPDATE customers c
      SET customer_facility = c.customer_owner || ' - ' || c.city
      WHERE c.tenant_id = 1
        AND c.city IS NOT NULL
        AND c.city != ''
        AND c.customer_owner IN (
          SELECT customer_owner
          FROM customers
          WHERE tenant_id = 1
          GROUP BY customer_owner
          HAVING COUNT(*) > 1
        )
    `);

    console.log('Updated', result.rowCount, 'customer facility names');

    // Show the updated records
    const check = await db.query(`
      SELECT customer_owner, customer_facility, city
      FROM customers
      WHERE tenant_id = 1
        AND customer_owner IN (
          SELECT customer_owner
          FROM customers
          WHERE tenant_id = 1
          GROUP BY customer_owner
          HAVING COUNT(*) > 1
        )
      ORDER BY customer_owner, city
    `);

    console.log('\nUpdated facilities:');
    check.rows.forEach(r => console.log(' ', r.customer_facility, '|', r.city));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fixDuplicates();
