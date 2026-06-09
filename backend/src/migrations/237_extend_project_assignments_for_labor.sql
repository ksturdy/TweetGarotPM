-- Migration 237: Extend project_assignments to support full crew scheduling
-- (start/end dates, role, shift, status, tags). Allows multiple time-boxed
-- assignments per (employee, project) so a person can be scheduled across
-- multiple work stretches.

ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS role VARCHAR(50);
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS shift_pattern VARCHAR(20);
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS shift_start_time TIME;
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS shift_end_time TIME;
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'planned';
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Backfill: pre-existing foreman rows had no role/dates/status
UPDATE project_assignments
SET role = COALESCE(role, 'Foreman'),
    status = COALESCE(status, 'active'),
    start_date = COALESCE(start_date, assigned_at::date)
WHERE role IS NULL OR status IS NULL OR start_date IS NULL;

-- Replace the (employee_id, project_id) uniqueness with one that includes
-- start_date, so the same employee can have multiple assignments on the same
-- project across different time windows.
ALTER TABLE project_assignments DROP CONSTRAINT IF EXISTS project_assignments_employee_project_unique;
ALTER TABLE project_assignments
  ADD CONSTRAINT project_assignments_employee_project_start_unique
  UNIQUE (employee_id, project_id, start_date);

CREATE INDEX IF NOT EXISTS idx_project_assignments_dates
  ON project_assignments(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_project_assignments_employee_start
  ON project_assignments(employee_id, start_date);
CREATE INDEX IF NOT EXISTS idx_project_assignments_project_status
  ON project_assignments(project_id, status);
