// Cleanup: remove vp_contracts rows whose contract_number looks like a Job
// Number (digits-after-dash, e.g. "44448-10") rather than a true Contract
// (trailing-bare-dash form, e.g. "44448-"). Also removes the auto-created
// `projects` row IF it has no user-created activity attached.
//
// Defaults to dry-run. Pass --execute to actually delete.
//
// Usage:
//   node src/scripts/cleanupJobAsContractRows.js                 # dry-run, all tenants
//   node src/scripts/cleanupJobAsContractRows.js --prefix 44448  # dry-run, narrowed
//   node src/scripts/cleanupJobAsContractRows.js --tenant 1      # dry-run, narrowed
//   node src/scripts/cleanupJobAsContractRows.js --execute       # apply deletes
//
// Requires DATABASE_URL via dotenv .env.

require('dotenv').config();
const db = require('../config/database');

// Tables whose rows we treat as "user activity". If any of these reference a
// candidate project, we SKIP deletion and report it so a human can decide.
const ACTIVITY_TABLES_BY_PROJECT_ID = [
  'rfis',
  'submittals',
  'change_orders',
  'daily_reports',
  'schedule_items',
  'specifications',
  'drawings',
  'field_purchase_orders',
  'piping_fitting_orders',
  'sm_fitting_orders',
  'safety_jsa',
  'weekly_goal_plans',
  'phase_schedule_items',
  'billing_forecast',
  'project_labor_rates',
  'gc_schedule_versions',
  // project_snapshots is auto-generated weekly Vista financial snapshots
  // (ON DELETE CASCADE) — not user content, intentionally excluded.
];

function parseArgs(argv) {
  const out = { tenantId: null, prefix: null, execute: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tenant' && argv[i + 1]) { out.tenantId = parseInt(argv[++i], 10); }
    else if (a === '--prefix' && argv[i + 1]) { out.prefix = argv[++i]; }
    else if (a === '--execute') { out.execute = true; }
  }
  return out;
}

async function tableExists(tableName) {
  const r = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1`,
    [tableName]
  );
  return r.rowCount > 0;
}

async function countActivity(projectId, availableTables) {
  const counts = {};
  for (const t of availableTables) {
    const r = await db.query(`SELECT COUNT(*)::int AS c FROM ${t} WHERE project_id = $1`, [projectId]);
    if (r.rows[0].c > 0) counts[t] = r.rows[0].c;
  }
  // attachments are polymorphic
  if (await tableExists('attachments')) {
    const r = await db.query(
      `SELECT COUNT(*)::int AS c FROM attachments WHERE entity_type = 'project' AND entity_id = $1`,
      [projectId]
    );
    if (r.rows[0].c > 0) counts['attachments'] = r.rows[0].c;
  }
  return counts;
}

async function main() {
  const { tenantId, prefix, execute } = parseArgs(process.argv);

  // Determine which activity tables actually exist in this DB
  const availableActivityTables = [];
  for (const t of ACTIVITY_TABLES_BY_PROJECT_ID) {
    if (await tableExists(t)) availableActivityTables.push(t);
  }
  console.log(`Checking ${availableActivityTables.length} activity tables: ${availableActivityTables.join(', ')}`);

  const params = [];
  const where = ["vc.contract_number ~ '-[0-9]+$'"];
  if (tenantId !== null) { params.push(tenantId); where.push(`vc.tenant_id = $${params.length}`); }
  if (prefix) { params.push(prefix + '%'); where.push(`vc.contract_number LIKE $${params.length}`); }

  const candidates = await db.query(
    `SELECT vc.id AS vp_contract_id, vc.tenant_id, vc.contract_number,
            vc.linked_project_id, vc.contract_amount, vc.description
       FROM vp_contracts vc
      WHERE ${where.join(' AND ')}
      ORDER BY vc.tenant_id, vc.contract_number`,
    params
  );

  console.log(`\nFound ${candidates.rowCount} candidate Job-pattern row(s) in vp_contracts`);
  if (tenantId !== null) console.log(`  filter: tenant_id=${tenantId}`);
  if (prefix) console.log(`  filter: contract_number LIKE '${prefix}%'`);

  const toDelete = [];
  const toSkip = [];

  for (const row of candidates.rows) {
    if (!row.linked_project_id) {
      toDelete.push({ ...row, reason: 'no linked project', activity: {} });
      continue;
    }
    const activity = await countActivity(row.linked_project_id, availableActivityTables);
    if (Object.keys(activity).length === 0) {
      toDelete.push({ ...row, reason: 'no user activity', activity });
    } else {
      toSkip.push({ ...row, activity });
    }
  }

  console.log(`\nSafe to delete : ${toDelete.length}`);
  console.log(`Skipped        : ${toSkip.length} (has user activity)`);

  if (toSkip.length > 0) {
    console.log('\nSkipped rows (have user activity):');
    for (const r of toSkip) {
      const detail = Object.entries(r.activity).map(([k, v]) => `${k}=${v}`).join(', ');
      console.log(`  ${r.contract_number} (project ${r.linked_project_id}): ${detail}`);
    }
  }

  if (toDelete.length > 0 && !execute) {
    console.log('\nFirst 10 rows that WOULD be deleted:');
    for (const r of toDelete.slice(0, 10)) {
      console.log(`  ${r.contract_number}  project_id=${r.linked_project_id ?? 'none'}  amt=${r.contract_amount}  "${r.description || ''}"`);
    }
    if (toDelete.length > 10) console.log(`  ... and ${toDelete.length - 10} more`);
  }

  if (!execute) {
    console.log('\nDRY RUN — no changes made. Re-run with --execute to apply deletes.');
    await db.pool.end();
    return;
  }

  if (toDelete.length === 0) {
    console.log('\nNothing to delete. Done.');
    await db.pool.end();
    return;
  }

  console.log('\nDELETING in a single transaction...');
  const client = await db.getClient();
  let projectsDeleted = 0;
  let vpContractsDeleted = 0;
  try {
    await client.query('BEGIN');
    for (const r of toDelete) {
      if (r.linked_project_id) {
        // vp_phase_codes.linked_project_id FK has no ON DELETE clause — null it out first.
        await client.query(
          `UPDATE vp_phase_codes SET linked_project_id = NULL WHERE linked_project_id = $1`,
          [r.linked_project_id]
        );
        const pd = await client.query(`DELETE FROM projects WHERE id = $1`, [r.linked_project_id]);
        projectsDeleted += pd.rowCount;
      }
      const cd = await client.query(`DELETE FROM vp_contracts WHERE id = $1`, [r.vp_contract_id]);
      vpContractsDeleted += cd.rowCount;
    }
    await client.query('COMMIT');
    console.log(`\nDeleted ${projectsDeleted} project(s) and ${vpContractsDeleted} vp_contracts row(s).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction rolled back due to error:', err.message);
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
  }

  await db.pool.end();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
