CREATE TABLE IF NOT EXISTS plumbing_designs (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL,
  name          VARCHAR(255) NOT NULL,
  hub_number    VARCHAR(100),
  project_id    INTEGER,
  created_by    INTEGER NOT NULL,
  design_data   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plumbing_designs_tenant ON plumbing_designs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plumbing_designs_project ON plumbing_designs(project_id);
