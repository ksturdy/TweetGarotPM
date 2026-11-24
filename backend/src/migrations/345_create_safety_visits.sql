-- Migration 345: Create safety_visits table
-- Supports the Safety Calendar — a 6-week drag-and-drop scheduling tool for site visits.
-- Stores proposed/confirmed/completed visits per project, travel details, and visit reports
-- using the same JSONB sections structure as safety_observations.

CREATE TABLE IF NOT EXISTS safety_visits (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id       INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number           INTEGER NOT NULL,

  visit_type       VARCHAR(50) NOT NULL DEFAULT 'routine'
    CHECK (visit_type IN ('kickoff', 'routine', 'follow_up')),

  status           VARCHAR(50) NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'confirmed', 'completed', 'cancelled')),

  scheduled_date   DATE,
  assigned_to      INTEGER REFERENCES users(id),

  -- Travel
  travel_hours_ow  NUMERIC(4,2),
  travel_notes     TEXT,
  is_out_of_state  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Report (filled on/after visit)
  completed_date   DATE,
  completed_by     INTEGER REFERENCES users(id),
  report_weather   VARCHAR(100),
  report_temp      SMALLINT,
  report_notes     TEXT,
  report_sections  JSONB DEFAULT '[]',

  created_by       INTEGER REFERENCES users(id),
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(project_id, number)
);

CREATE INDEX IF NOT EXISTS idx_safety_visits_tenant   ON safety_visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_safety_visits_project  ON safety_visits(project_id);
CREATE INDEX IF NOT EXISTS idx_safety_visits_date     ON safety_visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_safety_visits_assigned ON safety_visits(assigned_to);
CREATE INDEX IF NOT EXISTS idx_safety_visits_status   ON safety_visits(status);

DROP TRIGGER IF EXISTS update_safety_visits_updated_at ON safety_visits;
CREATE TRIGGER update_safety_visits_updated_at
  BEFORE UPDATE ON safety_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
