-- Add favorite column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT false;

-- Create index for faster sorting by favorites
CREATE INDEX IF NOT EXISTS idx_projects_favorite ON projects(favorite);
