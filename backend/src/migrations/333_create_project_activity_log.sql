-- Migration 333: Track Vista sync changes per project for accurate Recent Activity feed
CREATE TABLE IF NOT EXISTS project_activity_log (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  action VARCHAR(30) NOT NULL CHECK (action IN ('created', 'updated', 'status_changed')),
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  actor_name VARCHAR(255) NOT NULL DEFAULT 'Vista Sync',
  source VARCHAR(20) NOT NULL DEFAULT 'vista_sync' CHECK (source IN ('vista_sync', 'manual')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_project_activity_log_tenant_date ON project_activity_log(tenant_id, created_at DESC);
CREATE INDEX idx_project_activity_log_project ON project_activity_log(project_id);
