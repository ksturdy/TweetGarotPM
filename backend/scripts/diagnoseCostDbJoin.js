// One-off diagnostic for the Cost Database empty-state mystery:
// "N projects match filters, but no phase code data."
// Reports counts at each join boundary so we can tell whether it's a data
// gap (no Vista phase codes for those projects) or a join/linking gap.
require('dotenv').config();
const db = require('../src/config/database');

async function run() {
  // Adjust to match the user's filter — tenant_id=1, Hard-Closed, MFG-Paper, contract > $200k.
  const tenantId = 1;
  const status = 'Hard-Closed';
  const market = 'MFG-Paper';
  const minValue = 200000;

  const filterCte = `
    WITH filtered_projects AS (
      SELECT p.id, p.number, p.name,
             p.status,
             COALESCE(p.market, MAX(vc.primary_market)) AS market,
             COALESCE(MAX(vc.contract_amount), p.contract_value) AS contract_value,
             COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT vc.contract_number), NULL), '{}'::text[]) AS contract_numbers
      FROM projects p
      LEFT JOIN vp_contracts vc ON vc.linked_project_id = p.id
      WHERE p.tenant_id = $1
        AND p.status = $2
        AND (p.market = $3 OR vc.primary_market = $3)
        AND COALESCE(vc.contract_amount, p.contract_value) >= $4
      GROUP BY p.id, p.number, p.name, p.status, p.market, p.contract_value
    )
  `;
  const params = [tenantId, status, market, minValue];

  // 1) How many projects match?
  const match = await db.query(`${filterCte} SELECT COUNT(*)::int AS n FROM filtered_projects`, params);
  console.log(`Matching projects:                            ${match.rows[0].n}`);

  // 2) How many have ANY linked vp_contracts?
  const withContracts = await db.query(
    `${filterCte} SELECT COUNT(*)::int AS n FROM filtered_projects WHERE cardinality(contract_numbers) > 0`,
    params
  );
  console.log(`  with at least one linked vp_contract:       ${withContracts.rows[0].n}`);

  // 3) How many have phase codes via linked_project_id?
  const byDirect = await db.query(
    `${filterCte}
     SELECT COUNT(DISTINCT fp.id)::int AS n
     FROM filtered_projects fp
     JOIN vp_phase_codes pc ON pc.tenant_id = $1 AND pc.linked_project_id = fp.id`,
    params
  );
  console.log(`  with phase codes via linked_project_id:     ${byDirect.rows[0].n}`);

  // 4) How many have phase codes via contract path?
  const byContract = await db.query(
    `${filterCte}
     SELECT COUNT(DISTINCT fp.id)::int AS n
     FROM filtered_projects fp
     JOIN vp_phase_codes pc ON pc.tenant_id = $1
       AND pc.linked_project_id IS NULL
       AND cardinality(fp.contract_numbers) > 0
       AND pc.contract = ANY(fp.contract_numbers)`,
    params
  );
  console.log(`  with phase codes via contract path:         ${byContract.rows[0].n}`);

  // 5) Sample a few of the matched projects with their contract numbers
  //    and any matching phase code counts (either path).
  const samples = await db.query(
    `${filterCte}
     SELECT fp.id, fp.number, fp.name, fp.contract_value, fp.contract_numbers,
       (SELECT COUNT(*) FROM vp_phase_codes pc WHERE pc.tenant_id = $1 AND pc.linked_project_id = fp.id) AS direct_pc_rows,
       (SELECT COUNT(*) FROM vp_phase_codes pc WHERE pc.tenant_id = $1 AND pc.linked_project_id IS NULL AND pc.contract = ANY(fp.contract_numbers)) AS contract_pc_rows
     FROM filtered_projects fp
     ORDER BY fp.number
     LIMIT 6`,
    params
  );
  console.log('\nSample projects:');
  samples.rows.forEach(r => {
    console.log(`  ${r.number}  ${r.name}`);
    console.log(`    contract_value: $${Number(r.contract_value).toLocaleString()}`);
    console.log(`    contract_numbers: [${r.contract_numbers.join(', ') || '(none)'}]`);
    console.log(`    phase code rows direct: ${r.direct_pc_rows}  via contract: ${r.contract_pc_rows}`);
  });

  // 5b) Are there any phase code rows whose `contract` value *starts with*
  //     any of these projects' contract numbers? (Looks for format mismatch.)
  const fuzzyMatch = await db.query(
    `${filterCte}
     SELECT fp.number, fp.contract_numbers, ARRAY_AGG(DISTINCT pc.contract) AS pc_contracts_seen
     FROM filtered_projects fp
     JOIN vp_phase_codes pc ON pc.tenant_id = $1
       AND EXISTS (
         SELECT 1 FROM unnest(fp.contract_numbers) cn
         WHERE pc.contract LIKE cn || '%' OR cn LIKE pc.contract || '%'
       )
     GROUP BY fp.number, fp.contract_numbers
     LIMIT 5`,
    params
  );
  console.log('\nFuzzy contract-number matches (prefix-based):');
  if (fuzzyMatch.rows.length === 0) {
    console.log('  (none — no phase code rows have contract values resembling any matched project)');
  } else {
    fuzzyMatch.rows.forEach(r => {
      console.log(`  project ${r.number}: contract_numbers=[${r.contract_numbers.join(', ')}]  pc.contract values seen=[${r.pc_contracts_seen.join(', ')}]`);
    });
  }

  // 5c) Sample some pc.contract values to see what format they use.
  const pcContracts = await db.query(
    `SELECT DISTINCT contract FROM vp_phase_codes WHERE tenant_id = $1 AND contract IS NOT NULL ORDER BY contract LIMIT 10`,
    [tenantId]
  );
  console.log('\nSample vp_phase_codes.contract values (first 10):');
  pcContracts.rows.forEach(r => console.log(`  "${r.contract}"`));

  // 6) Sanity check: total phase code rows in the table?
  const totalPc = await db.query(`SELECT COUNT(*)::int AS n FROM vp_phase_codes WHERE tenant_id = $1`, [tenantId]);
  console.log(`\nTotal vp_phase_codes rows for tenant ${tenantId}: ${totalPc.rows[0].n}`);

  // 7) How many DISTINCT projects have ANY phase code rows linked directly?
  const projectsWithDirect = await db.query(
    `SELECT COUNT(DISTINCT linked_project_id)::int AS n FROM vp_phase_codes WHERE tenant_id = $1 AND linked_project_id IS NOT NULL`,
    [tenantId]
  );
  console.log(`Distinct projects with directly-linked phase codes (tenant-wide): ${projectsWithDirect.rows[0].n}`);

  process.exit(0);
}

run().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
