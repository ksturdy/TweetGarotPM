-- Migration 210: Create Stratus tables
-- Stratus is the model-content tracking system sourced from the BigData
-- Synapse view (s-bigdata-production-centralus-ondemand). For v1 we ingest
-- via XLSX upload; a future phase will sync directly from Synapse and reuse
-- the same schema. Each upload creates a stratus_imports row; the "current"
-- view per project = parts where import_id = latest import for that project.

CREATE TABLE IF NOT EXISTS stratus_imports (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  filename VARCHAR(500),
  source_project_name VARCHAR(500),
  row_count INTEGER NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ,

  imported_by INTEGER REFERENCES users(id),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stratus_imports_project
  ON stratus_imports(tenant_id, project_id, imported_at DESC);

CREATE TABLE IF NOT EXISTS stratus_parts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  import_id INTEGER NOT NULL REFERENCES stratus_imports(id) ON DELETE CASCADE,

  -- Identity from Stratus
  stratus_part_id UUID,
  cad_id VARCHAR(100),
  model_id UUID,
  assembly_id UUID,
  assembly_name VARCHAR(255),
  part_number VARCHAR(100),

  -- Description / classification
  service_name VARCHAR(255),
  service_abbreviation VARCHAR(50),
  fabrication_service VARCHAR(255),
  item_description VARCHAR(500),
  area VARCHAR(100),
  size VARCHAR(50),
  part_division VARCHAR(100),
  package_category VARCHAR(100),
  category VARCHAR(100),
  cost_category VARCHAR(100),

  -- Quantity dimensions
  length NUMERIC(14,4),
  item_weight NUMERIC(14,4),
  install_hours NUMERIC(14,4),

  -- Costs
  material_cost NUMERIC(14,2),
  install_cost NUMERIC(14,2),
  fabrication_cost NUMERIC(14,2),
  total_cost NUMERIC(14,2),

  -- Status + phase code linkage (the future bridge to phase schedule)
  part_tracking_status VARCHAR(100),
  part_field_phase_code VARCHAR(50),
  part_shop_phase_code VARCHAR(50),

  -- Tracking IDs
  weld_id VARCHAR(100),
  fit_id VARCHAR(100),
  qc_id VARCHAR(100),

  -- Milestone timestamps
  part_issue_to_shop_dt TIMESTAMPTZ,
  part_shipped_dt TIMESTAMPTZ,
  part_field_installed_dt TIMESTAMPTZ,
  fab_complete_date TIMESTAMPTZ,
  qaqc_complete_date TIMESTAMPTZ,

  -- Full source row for forward compatibility (extra columns Stratus may add)
  raw JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stratus_parts_project
  ON stratus_parts(tenant_id, project_id, import_id);
CREATE INDEX IF NOT EXISTS idx_stratus_parts_phase
  ON stratus_parts(tenant_id, project_id, import_id, part_field_phase_code);
CREATE INDEX IF NOT EXISTS idx_stratus_parts_status
  ON stratus_parts(tenant_id, project_id, import_id, part_tracking_status);
CREATE INDEX IF NOT EXISTS idx_stratus_parts_stratus_id
  ON stratus_parts(stratus_part_id);
