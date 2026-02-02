-- Migration: Change projects.manager_id to reference employees instead of users
-- This allows any employee to be a project manager, not just those with user accounts

-- First, create employee records for any users who are project managers but don't have employee records
INSERT INTO employees (user_id, first_name, last_name, email, employment_status, tenant_id, created_at, updated_at)
SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, 'active', u.tenant_id, NOW(), NOW()
FROM projects p
JOIN users u ON p.manager_id = u.id
WHERE NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.user_id = u.id AND e.tenant_id = u.tenant_id
)
AND u.tenant_id IS NOT NULL;

-- Create a temporary column to store the new employee_id
ALTER TABLE projects ADD COLUMN manager_employee_id INTEGER;

-- Populate the new column with employee IDs based on user_id mapping
UPDATE projects p
SET manager_employee_id = e.id
FROM employees e
WHERE e.user_id = p.manager_id
AND e.tenant_id = p.tenant_id;

-- Drop the old foreign key constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_manager_id_fkey;

-- Drop the old manager_id column
ALTER TABLE projects DROP COLUMN manager_id;

-- Rename the new column to manager_id
ALTER TABLE projects RENAME COLUMN manager_employee_id TO manager_id;

-- Add the new foreign key constraint referencing employees
ALTER TABLE projects ADD CONSTRAINT projects_manager_id_fkey
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON projects(manager_id);
