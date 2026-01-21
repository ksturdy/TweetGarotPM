-- Add market field to projects table
-- This aligns projects with the opportunities table market field

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS market VARCHAR(100);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_market ON projects(market);
