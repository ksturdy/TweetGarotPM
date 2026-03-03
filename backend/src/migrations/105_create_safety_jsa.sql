-- Migration: Create safety JSA (Job Safety Analysis) tables
-- Pre-task safety planning documents required before field work

CREATE TABLE IF NOT EXISTS safety_jsa (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,

  -- JSA Details
  task_description TEXT NOT NULL,
  work_location TEXT,
  date_of_work DATE NOT NULL,

  -- Environmental conditions
  weather VARCHAR(100),
  temperature VARCHAR(50),

  -- PPE Requirements (stored as JSONB array)
  ppe_required JSONB DEFAULT '[]',

  -- Status
  status VARCHAR(50) DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),

  -- Metadata
  notes TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(project_id, number)
);

-- Hazards identified and control measures
CREATE TABLE IF NOT EXISTS safety_jsa_hazards (
  id SERIAL PRIMARY KEY,
  jsa_id INTEGER NOT NULL REFERENCES safety_jsa(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  step_description TEXT NOT NULL,
  hazard TEXT NOT NULL,
  control_measure TEXT NOT NULL,
  responsible_person VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crew signatures / acknowledgments
CREATE TABLE IF NOT EXISTS safety_jsa_signatures (
  id SERIAL PRIMARY KEY,
  jsa_id INTEGER NOT NULL REFERENCES safety_jsa(id) ON DELETE CASCADE,
  employee_name VARCHAR(255) NOT NULL,
  employee_id INTEGER REFERENCES users(id),
  signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  signature_data TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jsa_project ON safety_jsa(project_id);
CREATE INDEX IF NOT EXISTS idx_jsa_tenant ON safety_jsa(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jsa_status ON safety_jsa(status);
CREATE INDEX IF NOT EXISTS idx_jsa_date ON safety_jsa(date_of_work);
CREATE INDEX IF NOT EXISTS idx_jsa_hazards ON safety_jsa_hazards(jsa_id);
CREATE INDEX IF NOT EXISTS idx_jsa_signatures ON safety_jsa_signatures(jsa_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_safety_jsa_updated_at ON safety_jsa;
CREATE TRIGGER update_safety_jsa_updated_at
  BEFORE UPDATE ON safety_jsa
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
