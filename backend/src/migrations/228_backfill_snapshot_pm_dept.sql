-- Backfill PM and Department columns on project_snapshots that pre-date
-- migration 225. Pulls from the current Vista contract linked to each project.
--
-- This is a best-effort backfill: historical snapshots get the CURRENT
-- PM/Dept assignment for their project. If a project's PM has changed
-- since an older snapshot, we accept that the historical record now
-- reflects today's assignment - we cannot reconstruct the actual PM at
-- the time the snapshot was taken.
--
-- Only updates rows where pm_name IS NULL so re-running is safe.

UPDATE project_snapshots ps
SET pm_name = vc.project_manager_name,
    pm_employee_no = vc.employee_number,
    department_code = vc.department_code,
    department_name = d.name
FROM vp_contracts vc
LEFT JOIN departments d ON vc.linked_department_id = d.id
WHERE ps.pm_name IS NULL
  AND vc.linked_project_id = ps.project_id
  AND vc.tenant_id = ps.tenant_id;
