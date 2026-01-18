-- Migration: Create Contract Review System for Risk Management
-- Description: Tables for managing contract risk analysis and review workflow

-- Contract Reviews Table
CREATE TABLE IF NOT EXISTS contract_reviews (
  id SERIAL PRIMARY KEY,

  -- Document Information
  file_name VARCHAR(500) NOT NULL,
  file_size INTEGER,
  file_path VARCHAR(1000),

  -- Project/Contract Details
  project_name VARCHAR(500),
  general_contractor VARCHAR(255),
  contract_value DECIMAL(15, 2),

  -- Analysis Results
  overall_risk VARCHAR(20) CHECK (overall_risk IN ('HIGH', 'MODERATE', 'LOW')),
  analysis_completed_at TIMESTAMP,

  -- Review Workflow
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'needs_revision')),
  needs_legal_review BOOLEAN DEFAULT false,

  -- User/Audit Fields
  uploaded_by INTEGER REFERENCES users(id),
  reviewed_by INTEGER REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),

  -- Notes and Decision
  review_notes TEXT,
  approval_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  approved_at TIMESTAMP
);

-- Contract Risk Findings Table
CREATE TABLE IF NOT EXISTS contract_risk_findings (
  id SERIAL PRIMARY KEY,
  contract_review_id INTEGER NOT NULL REFERENCES contract_reviews(id) ON DELETE CASCADE,

  -- Risk Details
  category VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('HIGH', 'MODERATE', 'LOW')),

  -- Finding Details
  finding TEXT NOT NULL,
  recommendation TEXT,

  -- Resolution
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'accepted', 'mitigated')),
  resolution_notes TEXT,
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contract Review Settings Table (for organization-wide settings)
CREATE TABLE IF NOT EXISTS contract_review_settings (
  id SERIAL PRIMARY KEY,

  -- Auto-flagging Rules
  legal_email VARCHAR(255) DEFAULT 'legal@tweetgarot.com',
  threshold_amount DECIMAL(15, 2) DEFAULT 2000000,

  -- Categories to flag at MODERATE level (stored as JSON array)
  flagged_categories JSONB DEFAULT '["payment_terms", "liquidated_damages", "consequential_damages", "change_orders", "schedule_delays", "lien_rights"]'::jsonb,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO contract_review_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Indexes for performance
CREATE INDEX idx_contract_reviews_status ON contract_reviews(status);
CREATE INDEX idx_contract_reviews_risk ON contract_reviews(overall_risk);
CREATE INDEX idx_contract_reviews_uploaded_by ON contract_reviews(uploaded_by);
CREATE INDEX idx_contract_reviews_created_at ON contract_reviews(created_at DESC);
CREATE INDEX idx_risk_findings_contract ON contract_risk_findings(contract_review_id);
CREATE INDEX idx_risk_findings_level ON contract_risk_findings(risk_level);
CREATE INDEX idx_risk_findings_status ON contract_risk_findings(status);

-- Update timestamp trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
DROP TRIGGER IF EXISTS update_contract_reviews_updated_at ON contract_reviews;
CREATE TRIGGER update_contract_reviews_updated_at
  BEFORE UPDATE ON contract_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_risk_findings_updated_at ON contract_risk_findings;
CREATE TRIGGER update_risk_findings_updated_at
  BEFORE UPDATE ON contract_risk_findings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
