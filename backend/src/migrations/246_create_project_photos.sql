-- Migration 246: Create project_photos table

CREATE TABLE IF NOT EXISTS project_photos (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  thumb_path VARCHAR(500),
  feed_path VARCHAR(500),
  file_size INTEGER,
  file_type VARCHAR(100),
  width INTEGER,
  height INTEGER,
  caption TEXT,
  tags TEXT,
  display_order INTEGER DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_photos_project_id ON project_photos(project_id);
CREATE INDEX IF NOT EXISTS idx_project_photos_tenant_id ON project_photos(tenant_id);
