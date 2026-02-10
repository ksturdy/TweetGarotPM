/**
 * Script to link projects to customers via vp_customers table
 * Matches projects.client to vp_customers.name, then uses linked_customer_id
 */
require('dotenv').config();
const db = require('../src/config/database');

async function linkProjects() {
  const client = await db.getClient();

  try {
    console.log('Starting project linking process...\n');

    // Step 1: Analyze projects data
    console.log('=== PROJECTS ANALYSIS ===');
    const projStats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(customer_id) as already_linked,
        COUNT(DISTINCT client) as unique_client_names
      FROM projects
    `);
    console.log('Total projects:', projStats.rows[0].total);
    console.log('Already linked:', projStats.rows[0].already_linked);
    console.log('Unique client names:', projStats.rows[0].unique_client_names);

    // Check how many can be matched via vp_customers
    const projMatchable = await client.query(`
      SELECT COUNT(DISTINCT p.client) as matchable_names,
             COUNT(*) as matchable_records
      FROM projects p
      WHERE p.customer_id IS NULL
        AND EXISTS (
          SELECT 1 FROM vp_customers vc
          WHERE vc.linked_customer_id IS NOT NULL
            AND LOWER(TRIM(vc.name)) = LOWER(TRIM(p.client))
        )
    `);
    console.log('Matchable client names via vp_customers:', projMatchable.rows[0].matchable_names);
    console.log('Matchable project records:', projMatchable.rows[0].matchable_records);

    // Step 2: Link projects to customers via vp_customers
    console.log('\nLinking projects to customers via vp_customers...');
    const projUpdateResult = await client.query(`
      UPDATE projects p
      SET customer_id = (
        SELECT vc.linked_customer_id
        FROM vp_customers vc
        WHERE vc.linked_customer_id IS NOT NULL
          AND LOWER(TRIM(vc.name)) = LOWER(TRIM(p.client))
        LIMIT 1
      )
      WHERE p.customer_id IS NULL
        AND EXISTS (
          SELECT 1 FROM vp_customers vc
          WHERE vc.linked_customer_id IS NOT NULL
            AND LOWER(TRIM(vc.name)) = LOWER(TRIM(p.client))
        )
    `);
    console.log('Projects linked:', projUpdateResult.rowCount);

    // Step 3: Final summary
    console.log('\n=== FINAL SUMMARY ===');
    const finalProjStats = await client.query(`
      SELECT COUNT(*) as linked FROM projects WHERE customer_id IS NOT NULL
    `);
    console.log('Projects now linked:', finalProjStats.rows[0].linked);

    // Show sample of unmatched
    console.log('\n=== SAMPLE UNMATCHED PROJECT CLIENTS ===');
    const unmatchedProj = await client.query(`
      SELECT DISTINCT client, COUNT(*) as count
      FROM projects
      WHERE customer_id IS NULL
        AND client IS NOT NULL
      GROUP BY client
      ORDER BY count DESC
      LIMIT 10
    `);
    if (unmatchedProj.rows.length > 0) {
      unmatchedProj.rows.forEach(r => console.log(`  - "${r.client}" (${r.count} records)`));
    } else {
      console.log('  All projects with client names are now linked!');
    }

    console.log('\nDone!');

  } catch (error) {
    console.error('Error linking projects:', error);
    throw error;
  } finally {
    client.release();
    await db.pool.end();
  }
}

linkProjects().catch(console.error);
