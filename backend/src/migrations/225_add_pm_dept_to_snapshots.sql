-- Capture PM and department on project_snapshots so the Monthly Projections
-- Report stays historically accurate if a project changes PM or department
-- between projection cycles.

ALTER TABLE project_snapshots
  ADD COLUMN IF NOT EXISTS pm_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS pm_employee_no VARCHAR(20),
  ADD COLUMN IF NOT EXISTS department_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS department_name VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_project_snapshots_pm
  ON project_snapshots(pm_employee_no);

CREATE INDEX IF NOT EXISTS idx_project_snapshots_department
  ON project_snapshots(department_code);
