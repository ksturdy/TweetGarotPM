-- Migration 242: Unfilled roles on project_assignments (#68)
-- Allows creating an assignment slot with no employee yet assigned.
-- The existing unique constraint (employee_id, project_id, start_date) must
-- be dropped and replaced with partial indexes so NULL employee_id rows don't
-- collide with each other.

-- Make employee_id nullable (it was NOT NULL implicitly via unique constraint)
ALTER TABLE project_assignments
  ALTER COLUMN employee_id DROP NOT NULL;

-- Add the is_unfilled flag and optional fill_notes
ALTER TABLE project_assignments
  ADD COLUMN IF NOT EXISTS is_unfilled   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fill_notes    TEXT;

-- Drop the old multi-column unique constraint (may be named differently
-- depending on how it was created; try both common names)
ALTER TABLE project_assignments
  DROP CONSTRAINT IF EXISTS project_assignments_employee_id_project_id_start_date_key;

-- Rebuild uniqueness as partial indexes:
--   1. Filled assignments: (employee_id, project_id, start_date) where not unfilled
--   2. Unfilled slots are allowed to have multiple rows per project/start_date

-- Partial unique for project-target filled assignments
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_filled_project_start
  ON project_assignments (employee_id, project_id, start_date)
  WHERE is_unfilled = FALSE AND project_id IS NOT NULL AND employee_id IS NOT NULL;

-- Partial unique for account-target filled assignments (from migration 241)
-- The migration 241 partial indexes already exist; this is a no-op guard
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_filled_account_start
  ON project_assignments (employee_id, labor_account_id, start_date)
  WHERE is_unfilled = FALSE AND labor_account_id IS NOT NULL AND employee_id IS NOT NULL;
