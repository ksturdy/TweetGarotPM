-- Backfill manager_id on projects imported from Vista contracts
-- Links: vp_contracts.employee_number -> vp_employees.employee_number -> vp_employees.linked_employee_id -> employees.id
UPDATE projects p
SET manager_id = ve.linked_employee_id
FROM vp_contracts vc
JOIN vp_employees ve ON ve.employee_number = vc.employee_number::INTEGER
  AND ve.linked_employee_id IS NOT NULL
WHERE vc.linked_project_id = p.id
  AND vc.tenant_id = p.tenant_id
  AND vc.employee_number IS NOT NULL
  AND vc.employee_number != ''
  AND p.manager_id IS NULL;

-- Backfill manager_id on projects imported from Vista work orders
UPDATE projects p
SET manager_id = ve.linked_employee_id
FROM vp_work_orders vwo
JOIN vp_employees ve ON ve.employee_number = vwo.employee_number::INTEGER
  AND ve.linked_employee_id IS NOT NULL
WHERE p.number = 'WO-' || vwo.work_order_number
  AND vwo.tenant_id = p.tenant_id
  AND vwo.employee_number IS NOT NULL
  AND vwo.employee_number != ''
  AND p.manager_id IS NULL;
