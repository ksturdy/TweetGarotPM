-- Migration 195: Track who last updated a project
-- Recent Activity feed was showing the project manager instead of the
-- actual editor because there was no field to record the latter.

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_projects_updated_by ON projects(updated_by);
