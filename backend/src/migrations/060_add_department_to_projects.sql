-- Add department_id to projects table for Vista integration
-- This links projects to their department based on VP contract data

-- Add department_id column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_department ON projects(department_id);

-- Update existing projects with department from linked VP contracts
UPDATE projects p
SET department_id = vc.linked_department_id
FROM vp_contracts vc
WHERE vc.linked_project_id = p.id
  AND vc.linked_department_id IS NOT NULL
  AND p.department_id IS NULL;

-- Add comment to explain field purpose
COMMENT ON COLUMN projects.department_id IS 'Department this project belongs to (from Vista ERP integration)';
