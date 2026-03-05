-- Field Issues reported by foremen from the field
CREATE TABLE IF NOT EXISTS field_issues (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  trade VARCHAR(50),
  location TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  source VARCHAR(20) NOT NULL DEFAULT 'field',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, number)
);

CREATE INDEX IF NOT EXISTS idx_field_issues_project ON field_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_field_issues_tenant ON field_issues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_field_issues_status ON field_issues(status);
