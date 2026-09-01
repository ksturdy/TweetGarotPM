-- Weekly weld production snapshots.
-- Captured automatically on every Stratus upload (weld inches locked at upload
-- time) and auto-refreshed whenever Vista phase codes are re-imported (so JTD
-- hours stay current once payroll posts mid-week).
CREATE TABLE IF NOT EXISTS stratus_production_snapshots (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INTEGER NOT NULL,
  project_id            INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_date         DATE NOT NULL,
  import_id             INTEGER REFERENCES stratus_imports(id) ON DELETE SET NULL,
  phase_code            VARCHAR(50) NOT NULL,
  weld_inches_complete  NUMERIC NOT NULL DEFAULT 0,
  shop_weld_inches      NUMERIC NOT NULL DEFAULT 0,
  field_weld_inches     NUMERIC NOT NULL DEFAULT 0,
  jtd_hours             NUMERIC,
  jtd_cost              NUMERIC,
  hours_refreshed_at    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, snapshot_date, phase_code)
);

CREATE INDEX IF NOT EXISTS idx_stratus_prod_snapshots_project_date
  ON stratus_production_snapshots(project_id, snapshot_date);
