CREATE TABLE IF NOT EXISTS project_scope_job_mappings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  historical_project_id INTEGER REFERENCES historical_projects(id) ON DELETE CASCADE,
  live_project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  scope VARCHAR(50) NOT NULL CHECK (scope IN ('HVAC', 'Plumbing', 'BAS')),
  vista_job VARCHAR(100) NOT NULL,
  cached_est_cost NUMERIC(14,2),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_exactly_one_project CHECK (
    (historical_project_id IS NOT NULL)::int + (live_project_id IS NOT NULL)::int = 1
  ),
  CONSTRAINT uq_historical_scope UNIQUE (tenant_id, historical_project_id, scope),
  CONSTRAINT uq_live_scope UNIQUE (tenant_id, live_project_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_psjm_hist ON project_scope_job_mappings(tenant_id, historical_project_id);
CREATE INDEX IF NOT EXISTS idx_psjm_live ON project_scope_job_mappings(tenant_id, live_project_id);

CREATE OR REPLACE FUNCTION update_psjm_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS psjm_updated_at ON project_scope_job_mappings;
CREATE TRIGGER psjm_updated_at
  BEFORE UPDATE ON project_scope_job_mappings
  FOR EACH ROW EXECUTE FUNCTION update_psjm_updated_at();
