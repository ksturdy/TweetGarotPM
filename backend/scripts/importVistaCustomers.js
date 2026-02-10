require('dotenv').config();
const db = require('../src/config/database');

async function importCustomersFromVista() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Get all Vista customers
    const vistaResult = await client.query(`
      SELECT id, customer_number, name, address, address2, city, state, zip, active
      FROM vp_customers
    `);

    console.log('Found', vistaResult.rows.length, 'Vista customers to import');

    let created = 0;
    let linked = 0;

    for (const vc of vistaResult.rows) {
      // Create Titan customer - use name as both facility and owner (can be updated later)
      const insertResult = await client.query(`
        INSERT INTO customers (
          customer_facility, customer_owner, customer_number,
          address, city, state, zip_code,
          active_customer, tenant_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW(), NOW())
        RETURNING id
      `, [
        vc.name,           // facility = name
        vc.name,           // owner = name (same for now)
        vc.customer_number,
        [vc.address, vc.address2].filter(Boolean).join(', '),
        vc.city,
        vc.state,
        vc.zip,
        vc.active === 'Y' || vc.active === true
      ]);

      const newCustomerId = insertResult.rows[0].id;
      created++;

      // Link the Vista record to the new Titan customer
      await client.query(`
        UPDATE vp_customers
        SET linked_customer_id = $1, link_status = 'auto_matched', linked_at = NOW()
        WHERE id = $2
      `, [newCustomerId, vc.id]);
      linked++;

      if (created % 500 === 0) {
        console.log(`Progress: ${created} customers created...`);
      }
    }

    await client.query('COMMIT');
    console.log('Created', created, 'Titan customers');
    console.log('Linked', linked, 'Vista customers');

    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

importCustomersFromVista();
