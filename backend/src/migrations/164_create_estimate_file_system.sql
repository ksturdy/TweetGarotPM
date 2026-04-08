-- Migration 164: Create estimate file/folder system
-- Adds folder and file management for estimates

-- Folders table
CREATE TABLE IF NOT EXISTS estimate_folders (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  folder_name VARCHAR(100) NOT NULL,
  folder_type VARCHAR(10) NOT NULL DEFAULT 'custom' CHECK (folder_type IN ('default', 'custom')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_estimate_folders_estimate ON estimate_folders(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_folders_tenant ON estimate_folders(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimate_folders_unique_name ON estimate_folders(estimate_id, folder_name);

-- Files table
CREATE TABLE IF NOT EXISTS estimate_files (
  id SERIAL PRIMARY KEY,
  folder_id INTEGER NOT NULL REFERENCES estimate_folders(id) ON DELETE CASCADE,
  estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  size BIGINT,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_estimate_files_folder ON estimate_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_estimate_files_estimate ON estimate_files(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_files_tenant ON estimate_files(tenant_id);
