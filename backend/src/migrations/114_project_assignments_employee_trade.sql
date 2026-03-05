-- Migration 114: Change project_assignments to use employee_id instead of user_id, add trade

-- Add employee_id column
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE;

-- Add trade column
ALTER TABLE project_assignments ADD COLUMN IF NOT EXISTS trade VARCHAR(50);

-- Make user_id nullable (assignments can be employee-only, no user account needed)
ALTER TABLE project_assignments ALTER COLUMN user_id DROP NOT NULL;

-- Migrate existing user_id assignments to employee_id where possible
UPDATE project_assignments pa
SET employee_id = e.id
FROM employees e
WHERE e.user_id = pa.user_id
  AND pa.employee_id IS NULL;

-- Drop old unique constraint and create new one based on employee_id + project_id
ALTER TABLE project_assignments DROP CONSTRAINT IF EXISTS project_assignments_user_id_project_id_key;
ALTER TABLE project_assignments ADD CONSTRAINT project_assignments_employee_project_unique UNIQUE(employee_id, project_id);

-- Index on employee_id
CREATE INDEX IF NOT EXISTS idx_project_assignments_employee ON project_assignments(employee_id);
