-- Migration: Create safety observations table
-- Field audit tool replacing the SharePoint Microsoft Forms flow

CREATE TABLE IF NOT EXISTS safety_observations (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,

  -- Observer (auto-filled from auth)
  observer_id INTEGER REFERENCES users(id),

  -- Date of observation (defaults to today, user-editable)
  date_of_observation DATE NOT NULL,

  -- Final-page global questions
  stretch_and_flex BOOLEAN,
  feedback_notes TEXT,

  -- All audit section answers stored as JSONB
  -- Structure: [{ area: string, items: [{ key: string, label: string, answer: 'yes'|'no'|'na' }], comments: string }]
  sections JSONB DEFAULT '[]',

  -- Status workflow
  status VARCHAR(50) DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'reviewed')),

  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,

  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(project_id, number)
);

CREATE INDEX IF NOT EXISTS idx_safety_obs_project ON safety_observations(project_id);
CREATE INDEX IF NOT EXISTS idx_safety_obs_tenant ON safety_observations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_safety_obs_status ON safety_observations(status);
CREATE INDEX IF NOT EXISTS idx_safety_obs_date ON safety_observations(date_of_observation);
CREATE INDEX IF NOT EXISTS idx_safety_obs_observer ON safety_observations(observer_id);

DROP TRIGGER IF EXISTS update_safety_observations_updated_at ON safety_observations;
CREATE TRIGGER update_safety_observations_updated_at
  BEFORE UPDATE ON safety_observations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
