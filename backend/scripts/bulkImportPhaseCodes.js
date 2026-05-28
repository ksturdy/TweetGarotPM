// One-off bulk import of VP Data/Phase Codes.xlsx into vp_phase_codes.
//
// Uses INSERT ... ON CONFLICT DO UPDATE keyed on the table's unique constraint
// (tenant_id, job, cost_type, phase). Batched at 500 rows per query for
// efficiency. After insertion, runs linkPhaseCodesByContract() to attach the
// new phase codes to projects via vp_contracts.
//
// SAFE BY DESIGN:
//   - No DELETE / TRUNCATE.
//   - Upsert means rows already in the table get refreshed (the file is fresh,
//     so this is what we want); rows not in the file are untouched.
//   - Wrapped in informative logging so progress is visible.
//
// Usage:
//   cd backend
//   node scripts/bulkImportPhaseCodes.js [tenantId] [adminUserId]
//   (defaults: tenantId=1, adminUserId=1)

require('dotenv').config();
const path = require('path');
const XLSX = require('xlsx');
const db = require('../src/config/database');
const VistaData = require('../src/models/VistaData');

const TENANT_ID = parseInt(process.argv[2] || '1', 10);
const IMPORTED_BY = parseInt(process.argv[3] || '1', 10);
const BATCH_SIZE = 500;
const FILE_PATH = path.join(__dirname, '..', '..', 'VP Data', 'Phase Codes.xlsx');

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function buildRow(r) {
  return {
    contract: String(r['Contract'] || '').trim(),
    job: String(r['Job'] || '').trim(),
    job_description: r['Job Description'] || '',
    cost_type: parseInt(r['CostType']) || 0,
    phase: String(r['Phase'] || '').trim(),
    phase_description: String(r['Phase Description'] || '').trim(),
    est_hours: parseNumber(r['Est Hours'] ?? r[' Est Hours ']),
    est_cost: parseNumber(r[' Est Cost '] ?? r['Est Cost']),
    jtd_hours: parseNumber(r[' JTD Hours '] ?? r['JTD Hours']),
    jtd_cost: parseNumber(r[' JTD Cost '] ?? r['JTD Cost']),
    committed_cost: parseNumber(r[' Committed Cost '] ?? r['Committed Cost']),
    projected_cost: parseNumber(r[' Projected At Completion Cost '] ?? r['Projected At Completion Cost']),
    percent_complete: parseNumber(r['Percent Complete'] ?? r[' Percent Complete ']),
    prior_week_cost: parseNumber(r['Previous Week Cost'] ?? r[' Previous Week Cost ']) || 0,
    change_from_last_projection: parseNumber(r['Change From Last Projection'] ?? r[' Change From Last Projection ']) || 0,
  };
}

async function run() {
  console.log(`Reading ${FILE_PATH}...`);
  const wb = XLSX.readFile(FILE_PATH);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Phase Codes'], { defval: null });
  const valid = rows
    .map(buildRow)
    .filter(r => r.job && r.phase);

  console.log(`Total rows: ${rows.length}`);
  console.log(`Valid rows (have job + phase): ${valid.length}`);
  console.log(`Tenant: ${TENANT_ID}, Imported by user: ${IMPORTED_BY}`);
  console.log(`Batch size: ${BATCH_SIZE}\n`);

  // Create the import batch record
  const batch = await VistaData.createImportBatch({
    file_name: 'Phase Codes.xlsx (bulk all-status)',
    file_type: 'phase_codes',
    records_total: valid.length,
    imported_by: IMPORTED_BY,
  }, TENANT_ID);
  console.log(`Created import batch id=${batch.id}\n`);

  const COLS = [
    'tenant_id', 'contract', 'job', 'job_description', 'cost_type', 'phase',
    'phase_description', 'est_hours', 'est_cost', 'jtd_hours', 'jtd_cost',
    'committed_cost', 'projected_cost', 'percent_complete', 'import_batch_id',
    'prior_week_cost', 'change_from_last_projection',
  ];
  const PARAMS_PER_ROW = COLS.length;

  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const chunk = valid.slice(i, i + BATCH_SIZE);
    const values = [];
    const params = [];

    chunk.forEach((row, j) => {
      const base = j * PARAMS_PER_ROW;
      const placeholders = COLS.map((_, k) => `$${base + k + 1}`).join(', ');
      values.push(`(${placeholders})`);
      params.push(
        TENANT_ID, row.contract, row.job, row.job_description, row.cost_type, row.phase,
        row.phase_description, row.est_hours, row.est_cost, row.jtd_hours, row.jtd_cost,
        row.committed_cost, row.projected_cost, row.percent_complete, batch.id,
        row.prior_week_cost, row.change_from_last_projection,
      );
    });

    const sql = `
      INSERT INTO vp_phase_codes (${COLS.join(', ')})
      VALUES ${values.join(', ')}
      ON CONFLICT (tenant_id, job, cost_type, phase) DO UPDATE SET
        contract = EXCLUDED.contract,
        job_description = EXCLUDED.job_description,
        phase_description = EXCLUDED.phase_description,
        est_hours = EXCLUDED.est_hours,
        est_cost = EXCLUDED.est_cost,
        jtd_hours = EXCLUDED.jtd_hours,
        jtd_cost = EXCLUDED.jtd_cost,
        committed_cost = EXCLUDED.committed_cost,
        projected_cost = EXCLUDED.projected_cost,
        percent_complete = EXCLUDED.percent_complete,
        import_batch_id = EXCLUDED.import_batch_id,
        prior_week_cost = EXCLUDED.prior_week_cost,
        change_from_last_projection = EXCLUDED.change_from_last_projection,
        updated_at = CURRENT_TIMESTAMP
      RETURNING (xmax = 0) AS inserted
    `;

    try {
      const result = await db.query(sql, params);
      result.rows.forEach(r => {
        if (r.inserted) newCount++;
        else updatedCount++;
      });
    } catch (err) {
      errorCount += chunk.length;
      console.error(`Batch ${i}-${i + chunk.length} failed: ${err.message}`);
    }

    const done = Math.min(i + BATCH_SIZE, valid.length);
    const pct = ((done / valid.length) * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(`\r  ${done}/${valid.length} (${pct}%)  new=${newCount} updated=${updatedCount} errors=${errorCount}  ${elapsed}s`);
  }

  console.log('\n');
  console.log(`Inserts:  ${newCount}`);
  console.log(`Updates:  ${updatedCount}`);
  console.log(`Errors:   ${errorCount}`);

  await VistaData.updateImportBatch(batch.id, {
    records_new: newCount,
    records_updated: updatedCount,
  });

  console.log('\nRunning linkPhaseCodesByContract...');
  const linked = await VistaData.linkPhaseCodesByContract(TENANT_ID);
  console.log(`  Newly linked rows: ${linked}`);

  // Final stats
  const totals = await db.query(
    `SELECT
       COUNT(*) AS total_rows,
       COUNT(DISTINCT job) AS distinct_jobs,
       COUNT(DISTINCT linked_project_id) FILTER (WHERE linked_project_id IS NOT NULL) AS linked_projects
     FROM vp_phase_codes WHERE tenant_id = $1`,
    [TENANT_ID]
  );
  console.log('\nFinal vp_phase_codes state for tenant', TENANT_ID, ':');
  console.log(`  total rows:        ${totals.rows[0].total_rows}`);
  console.log(`  distinct jobs:     ${totals.rows[0].distinct_jobs}`);
  console.log(`  linked projects:   ${totals.rows[0].linked_projects}`);

  process.exit(0);
}

run().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
