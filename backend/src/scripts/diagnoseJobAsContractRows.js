// Read-only diagnostic: find vp_contracts rows whose contract_number looks like
// a Vista Job Number (digits-after-dash suffix, e.g. "44448-10") rather than a
// Contract Number (trailing-dash form, e.g. "44448-"). Reports import batch
// provenance and whether each one has produced a row in `projects`.
//
// Usage:
//   node src/scripts/diagnoseJobAsContractRows.js                # all tenants
//   node src/scripts/diagnoseJobAsContractRows.js --tenant 1     # filter
//   node src/scripts/diagnoseJobAsContractRows.js --prefix 44448 # only that contract family
//
// Requires DATABASE_URL (via dotenv .env). Read-only — makes no writes.

require('dotenv').config();
const db = require('../config/database');

function parseArgs(argv) {
  const out = { tenantId: null, prefix: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--tenant' && argv[i + 1]) { out.tenantId = parseInt(argv[++i], 10); }
    else if (a === '--prefix' && argv[i + 1]) { out.prefix = argv[++i]; }
  }
  return out;
}

async function main() {
  const { tenantId, prefix } = parseArgs(process.argv);

  const params = [];
  const where = ["vc.contract_number ~ '-[0-9]+$'"];
  if (tenantId !== null) { params.push(tenantId); where.push(`vc.tenant_id = $${params.length}`); }
  if (prefix) { params.push(prefix + '%'); where.push(`vc.contract_number LIKE $${params.length}`); }

  const sql = `
    SELECT
      vc.tenant_id,
      vc.contract_number,
      vc.description,
      vc.customer_name,
      vc.contract_amount,
      vc.start_month,
      vc.imported_at,
      vc.import_batch_id,
      vc.linked_project_id,
      vc.link_status,
      b.file_name        AS batch_file,
      b.imported_at      AS batch_imported_at,
      b.file_type        AS batch_file_type,
      u.email            AS batch_imported_by_email,
      p.id               AS project_id,
      p.number           AS project_number,
      p.name             AS project_name,
      p.created_at       AS project_created_at,
      (SELECT COUNT(*) FROM vp_phase_codes pc
         WHERE pc.tenant_id = vc.tenant_id AND pc.contract = vc.contract_number) AS phase_code_rows_as_contract,
      (SELECT COUNT(*) FROM vp_phase_codes pc
         WHERE pc.tenant_id = vc.tenant_id AND pc.job = vc.contract_number) AS phase_code_rows_as_job
    FROM vp_contracts vc
    LEFT JOIN vp_import_batches b ON b.id = vc.import_batch_id
    LEFT JOIN users u             ON u.id = b.imported_by
    LEFT JOIN projects p          ON p.id = vc.linked_project_id
    WHERE ${where.join(' AND ')}
    ORDER BY vc.tenant_id, vc.contract_number
  `;

  const { rows } = await db.query(sql, params);

  console.log(`\nFound ${rows.length} vp_contracts row(s) whose contract_number looks like a Job (matches '-[0-9]+$')`);
  if (tenantId !== null) console.log(`  filter: tenant_id=${tenantId}`);
  if (prefix) console.log(`  filter: contract_number LIKE '${prefix}%'`);
  console.log('');

  if (rows.length === 0) {
    await db.pool.end();
    return;
  }

  for (const r of rows) {
    console.log('─'.repeat(78));
    console.log(`contract_number      : ${r.contract_number}    (tenant ${r.tenant_id})`);
    console.log(`description          : ${r.description || '(blank)'}`);
    console.log(`customer_name        : ${r.customer_name || '(blank)'}`);
    console.log(`contract_amount      : ${r.contract_amount ?? 'NULL'}`);
    console.log(`start_month          : ${r.start_month ?? 'NULL'}`);
    console.log(`imported_at          : ${r.imported_at}`);
    console.log(`link_status          : ${r.link_status}`);
    console.log(`import batch         : id=${r.import_batch_id} file="${r.batch_file ?? '(unknown)'}" type=${r.batch_file_type ?? '?'} at=${r.batch_imported_at ?? '?'} by=${r.batch_imported_by_email ?? '(auto/unknown)'}`);
    if (r.project_id) {
      console.log(`linked project       : id=${r.project_id} number="${r.project_number}" name="${r.project_name}" created=${r.project_created_at}`);
    } else {
      console.log(`linked project       : (none — link_status=${r.link_status})`);
    }
    console.log(`phase_codes refs     : as contract=${r.phase_code_rows_as_contract}, as job=${r.phase_code_rows_as_job}`);
  }

  // Group by import batch so it's obvious if these all came from one upload
  console.log('\n' + '═'.repeat(78));
  console.log('Summary by import batch:');
  const byBatch = new Map();
  for (const r of rows) {
    const key = r.import_batch_id ?? 'NULL';
    if (!byBatch.has(key)) byBatch.set(key, { count: 0, file: r.batch_file, at: r.batch_imported_at, type: r.batch_file_type });
    byBatch.get(key).count++;
  }
  for (const [batchId, info] of byBatch) {
    console.log(`  batch ${batchId}: ${info.count} row(s)  file="${info.file ?? '(unknown)'}"  type=${info.type ?? '?'}  at=${info.at ?? '?'}`);
  }

  await db.pool.end();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
