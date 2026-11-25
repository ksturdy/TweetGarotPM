CREATE TABLE IF NOT EXISTS safety_visit_series (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  frequency        VARCHAR(20) NOT NULL
    CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  occurrences      SMALLINT,
  end_by_date      DATE,

  visit_type       VARCHAR(50) NOT NULL DEFAULT 'routine',
  assigned_to      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  travel_hours_ow  NUMERIC(4,2),
  travel_notes     TEXT,
  is_out_of_state  BOOLEAN NOT NULL DEFAULT FALSE,

  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_safety_visit_series_tenant  ON safety_visit_series(tenant_id);
CREATE INDEX IF NOT EXISTS idx_safety_visit_series_project ON safety_visit_series(project_id);

DROP TRIGGER IF EXISTS update_safety_visit_series_updated_at ON safety_visit_series;
CREATE TRIGGER update_safety_visit_series_updated_at
  BEFORE UPDATE ON safety_visit_series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE safety_visits
  ADD COLUMN IF NOT EXISTS series_id       INTEGER REFERENCES safety_visit_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_position SMALLINT;

CREATE INDEX IF NOT EXISTS idx_safety_visits_series ON safety_visits(series_id);
