-- Migration 165: Add nested folder support to estimate file system
-- Adds parent_folder_id for hierarchical folder structure

ALTER TABLE estimate_folders
  ADD COLUMN IF NOT EXISTS parent_folder_id INTEGER REFERENCES estimate_folders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_estimate_folders_parent ON estimate_folders(parent_folder_id);

-- Replace the old unique constraint (estimate_id, folder_name) with one that includes parent
-- This allows same-named folders under different parents
DROP INDEX IF EXISTS idx_estimate_folders_unique_name;
CREATE UNIQUE INDEX idx_estimate_folders_unique_name ON estimate_folders(estimate_id, COALESCE(parent_folder_id, 0), folder_name);
