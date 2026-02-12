-- Migration 078: Create Employee Resumes Table
-- Manages employee resumes for inclusion in proposals

CREATE TABLE IF NOT EXISTS employee_resumes (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Employee reference (link to employees table if available, otherwise just store name)
  employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  employee_name VARCHAR(255) NOT NULL,
  job_title VARCHAR(255) NOT NULL,
  years_experience INTEGER,

  -- Resume content
  summary TEXT NOT NULL,
  certifications JSONB DEFAULT '[]'::jsonb, -- Array of certification objects
  skills TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of skills
  education TEXT,

  -- Resume file (PDF/Word)
  resume_file_name VARCHAR(255),
  resume_file_path VARCHAR(500),
  resume_file_size INTEGER,
  resume_file_type VARCHAR(100),

  -- Status and versioning
  is_active BOOLEAN DEFAULT true,
  version_number INTEGER DEFAULT 1,
  last_updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employee_resumes_tenant ON employee_resumes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_resumes_employee ON employee_resumes(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_resumes_active ON employee_resumes(is_active);
CREATE INDEX IF NOT EXISTS idx_employee_resumes_name ON employee_resumes(employee_name);

-- Comments
COMMENT ON TABLE employee_resumes IS 'Employee resumes for inclusion in proposals';
COMMENT ON COLUMN employee_resumes.certifications IS 'JSON array of certifications: [{"name": "PE License", "issuer": "State Board", "year": 2020}]';
COMMENT ON COLUMN employee_resumes.skills IS 'Array of skills/specializations';
COMMENT ON COLUMN employee_resumes.version_number IS 'Version number for tracking resume updates';
