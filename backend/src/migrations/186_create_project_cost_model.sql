-- Project Cost Model: equipment counts and metadata for active projects
-- Feeds into the Cost Database (historical_projects) for estimating

CREATE TABLE IF NOT EXISTS project_cost_models (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  total_sqft DECIMAL(10,2),
  building_type VARCHAR(100),
  project_type VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id)
);

CREATE TABLE IF NOT EXISTS project_equipment (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  equipment_type VARCHAR(100) NOT NULL,
  equipment_label VARCHAR(255) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  is_custom BOOLEAN DEFAULT FALSE,
  notes TEXT,
  source VARCHAR(50) DEFAULT 'manual',
  ai_confidence DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, equipment_type)
);

CREATE INDEX idx_project_cost_models_project ON project_cost_models(project_id);
CREATE INDEX idx_project_cost_models_tenant ON project_cost_models(tenant_id);
CREATE INDEX idx_project_equipment_project ON project_equipment(project_id);
CREATE INDEX idx_project_equipment_tenant ON project_equipment(tenant_id);
CREATE INDEX idx_project_equipment_type ON project_equipment(equipment_type);
