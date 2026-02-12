-- Migration 084: Create junction tables for proposal integrations
-- Links proposals to case studies, service offerings, and employee resumes

-- 1. proposal_case_studies
CREATE TABLE IF NOT EXISTS proposal_case_studies (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  case_study_id INTEGER NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(proposal_id, case_study_id)
);

CREATE INDEX IF NOT EXISTS idx_proposal_case_studies_proposal ON proposal_case_studies(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_case_studies_case_study ON proposal_case_studies(case_study_id);

-- 2. proposal_service_offerings
CREATE TABLE IF NOT EXISTS proposal_service_offerings (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  service_offering_id INTEGER NOT NULL REFERENCES service_offerings(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 1,
  custom_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(proposal_id, service_offering_id)
);

CREATE INDEX IF NOT EXISTS idx_proposal_service_offerings_proposal ON proposal_service_offerings(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_service_offerings_service ON proposal_service_offerings(service_offering_id);

-- 3. proposal_resumes
CREATE TABLE IF NOT EXISTS proposal_resumes (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  resume_id INTEGER NOT NULL REFERENCES employee_resumes(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 1,
  role_on_project VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(proposal_id, resume_id)
);

CREATE INDEX IF NOT EXISTS idx_proposal_resumes_proposal ON proposal_resumes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_resumes_resume ON proposal_resumes(resume_id);
