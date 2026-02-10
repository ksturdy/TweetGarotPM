/**
 * Script to link work orders and projects to customers
 * by matching customer_name/client_name to customer_owner in the customers table
 */
require('dotenv').config();
const db = require('../src/config/database');

async function linkCustomerData() {
  const client = await db.getClient();

  try {
    console.log('Starting customer data linking process...\n');

    // Step 1: Analyze work orders data
    console.log('=== WORK ORDERS ANALYSIS ===');
    const woStats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(linked_customer_id) as already_linked,
        COUNT(DISTINCT customer_name) as unique_customer_names
      FROM vp_work_orders
    `);
    console.log('Total work orders:', woStats.rows[0].total);
    console.log('Already linked:', woStats.rows[0].already_linked);
    console.log('Unique customer names:', woStats.rows[0].unique_customer_names);

    // Check how many can be matched
    const woMatchable = await client.query(`
      SELECT COUNT(DISTINCT wo.customer_name) as matchable_names,
             COUNT(*) as matchable_records
      FROM vp_work_orders wo
      WHERE wo.linked_customer_id IS NULL
        AND EXISTS (
          SELECT 1 FROM customers c
          WHERE LOWER(TRIM(c.customer_owner)) = LOWER(TRIM(wo.customer_name))
        )
    `);
    console.log('Matchable customer names:', woMatchable.rows[0].matchable_names);
    console.log('Matchable work order records:', woMatchable.rows[0].matchable_records);

    // Step 2: Link work orders to customers (using first matching customer per owner)
    console.log('\nLinking work orders to customers...');
    const woUpdateResult = await client.query(`
      UPDATE vp_work_orders wo
      SET linked_customer_id = (
        SELECT MIN(c.id)
        FROM customers c
        WHERE LOWER(TRIM(c.customer_owner)) = LOWER(TRIM(wo.customer_name))
      )
      WHERE wo.linked_customer_id IS NULL
        AND EXISTS (
          SELECT 1 FROM customers c
          WHERE LOWER(TRIM(c.customer_owner)) = LOWER(TRIM(wo.customer_name))
        )
    `);
    console.log('Work orders linked:', woUpdateResult.rowCount);

    // Step 3: Analyze projects data
    console.log('\n=== PROJECTS ANALYSIS ===');
    const projStats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(customer_id) as already_linked,
        COUNT(DISTINCT client_name) as unique_client_names
      FROM projects
    `);
    console.log('Total projects:', projStats.rows[0].total);
    console.log('Already linked:', projStats.rows[0].already_linked);
    console.log('Unique client names:', projStats.rows[0].unique_client_names);

    // Check how many projects can be matched
    const projMatchable = await client.query(`
      SELECT COUNT(DISTINCT p.client_name) as matchable_names,
             COUNT(*) as matchable_records
      FROM projects p
      WHERE p.customer_id IS NULL
        AND EXISTS (
          SELECT 1 FROM customers c
          WHERE LOWER(TRIM(c.customer_owner)) = LOWER(TRIM(p.client_name))
        )
    `);
    console.log('Matchable client names:', projMatchable.rows[0].matchable_names);
    console.log('Matchable project records:', projMatchable.rows[0].matchable_records);

    // Step 4: Link projects to customers
    console.log('\nLinking projects to customers...');
    const projUpdateResult = await client.query(`
      UPDATE projects p
      SET customer_id = (
        SELECT MIN(c.id)
        FROM customers c
        WHERE LOWER(TRIM(c.customer_owner)) = LOWER(TRIM(p.client_name))
      )
      WHERE p.customer_id IS NULL
        AND EXISTS (
          SELECT 1 FROM customers c
          WHERE LOWER(TRIM(c.customer_owner)) = LOWER(TRIM(p.client_name))
        )
    `);
    console.log('Projects linked:', projUpdateResult.rowCount);

    // Step 5: Final summary
    console.log('\n=== FINAL SUMMARY ===');
    const finalWoStats = await client.query(`
      SELECT COUNT(*) as linked FROM vp_work_orders WHERE linked_customer_id IS NOT NULL
    `);
    const finalProjStats = await client.query(`
      SELECT COUNT(*) as linked FROM projects WHERE customer_id IS NOT NULL
    `);
    console.log('Work orders now linked:', finalWoStats.rows[0].linked);
    console.log('Projects now linked:', finalProjStats.rows[0].linked);

    // Show sample of unmatched
    console.log('\n=== SAMPLE UNMATCHED WORK ORDER CUSTOMERS ===');
    const unmatchedWo = await client.query(`
      SELECT DISTINCT customer_name, COUNT(*) as count
      FROM vp_work_orders
      WHERE linked_customer_id IS NULL
        AND customer_name IS NOT NULL
      GROUP BY customer_name
      ORDER BY count DESC
      LIMIT 10
    `);
    unmatchedWo.rows.forEach(r => console.log(`  - "${r.customer_name}" (${r.count} records)`));

    console.log('\n=== SAMPLE UNMATCHED PROJECT CLIENTS ===');
    const unmatchedProj = await client.query(`
      SELECT DISTINCT client_name, COUNT(*) as count
      FROM projects
      WHERE customer_id IS NULL
        AND client_name IS NOT NULL
      GROUP BY client_name
      ORDER BY count DESC
      LIMIT 10
    `);
    unmatchedProj.rows.forEach(r => console.log(`  - "${r.client_name}" (${r.count} records)`));

    console.log('\nDone!');

  } catch (error) {
    console.error('Error linking customer data:', error);
    throw error;
  } finally {
    client.release();
    await db.pool.end();
  }
}

linkCustomerData().catch(console.error);
