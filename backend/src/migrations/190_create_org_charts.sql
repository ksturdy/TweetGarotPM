-- Migration 190: Create org_charts table for project-specific org charts
-- These are standalone org charts (optionally linked to a project) used in the Marketing module

CREATE TABLE IF NOT EXISTS org_charts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_charts_tenant ON org_charts(tenant_id);
CREATE INDEX idx_org_charts_project ON org_charts(tenant_id, project_id);
