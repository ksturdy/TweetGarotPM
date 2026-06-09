require('dotenv').config();
const db = require('../src/config/database');

(async () => {
  try {
    const contractDrift = await db.query(
      `SELECT vc.contract_number, p.id AS project_id, p.name,
              p.manager_id AS titan_mgr_id,
              te.first_name || ' ' || te.last_name AS titan_pm,
              COALESCE(e.id, vpe.linked_employee_id) AS vista_mgr_id,
              COALESCE(e.first_name || ' ' || e.last_name,
                       vpe.first_name || ' ' || vpe.last_name) AS vista_pm
       FROM vp_contracts vc
       JOIN projects p ON p.id = vc.linked_project_id AND p.tenant_id = vc.tenant_id
       LEFT JOIN employees te ON te.id = p.manager_id
       LEFT JOIN employees e ON e.employee_number = vc.employee_number::text AND e.tenant_id = vc.tenant_id
       LEFT JOIN vp_employees vpe ON vpe.employee_number = vc.employee_number::int AND vpe.linked_employee_id IS NOT NULL
       WHERE vc.tenant_id = 1
         AND vc.linked_project_id IS NOT NULL
         AND COALESCE(e.id, vpe.linked_employee_id) IS NOT NULL
         AND COALESCE(e.id, vpe.linked_employee_id) <> p.manager_id
       ORDER BY vc.contract_number`
    );

    const woDrift = await db.query(
      `SELECT vw.work_order_number, p.id AS project_id, p.name,
              p.manager_id AS titan_mgr_id,
              te.first_name || ' ' || te.last_name AS titan_pm,
              COALESCE(e.id, vpe.linked_employee_id) AS vista_mgr_id,
              COALESCE(e.first_name || ' ' || e.last_name,
                       vpe.first_name || ' ' || vpe.last_name) AS vista_pm
       FROM vp_work_orders vw
       JOIN projects p ON p.number = 'WO-' || vw.work_order_number AND p.tenant_id = vw.tenant_id
       LEFT JOIN employees te ON te.id = p.manager_id
       LEFT JOIN employees e ON e.employee_number = vw.employee_number::text AND e.tenant_id = vw.tenant_id
       LEFT JOIN vp_employees vpe ON vpe.employee_number = vw.employee_number::int AND vpe.linked_employee_id IS NOT NULL
       WHERE vw.tenant_id = 1
         AND vw.link_status IN ('auto_matched','manual_matched')
         AND COALESCE(e.id, vpe.linked_employee_id) IS NOT NULL
         AND COALESCE(e.id, vpe.linked_employee_id) <> p.manager_id
       ORDER BY vw.work_order_number`
    );

    console.log(`\n=== Projects with wrong PM ===`);
    console.log(`Contracts: ${contractDrift.rows.length}`);
    console.log(`Work orders: ${woDrift.rows.length}`);
    console.log(`TOTAL: ${contractDrift.rows.length + woDrift.rows.length}\n`);

    console.log('Contract PM mismatches:');
    contractDrift.rows.forEach(r => {
      console.log(`  ${r.contract_number}  "${r.name}"  Titan: ${r.titan_pm || 'none'}  →  Vista: ${r.vista_pm}`);
    });

    if (woDrift.rows.length > 0) {
      console.log('\nWork order PM mismatches:');
      woDrift.rows.forEach(r => {
        console.log(`  WO-${r.work_order_number}  "${r.name}"  Titan: ${r.titan_pm || 'none'}  →  Vista: ${r.vista_pm}`);
      });
    }

    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
