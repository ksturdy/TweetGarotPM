-- Add geocoding columns to projects table for map visualization
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP;

-- Index for querying projects with coordinates (for the map page)
CREATE INDEX IF NOT EXISTS idx_projects_geocoded
  ON projects(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
