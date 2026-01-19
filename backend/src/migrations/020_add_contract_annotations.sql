-- Migration: Add annotation and location tracking for contract reviews
-- Description: Support for highlighting, annotations, and location tracking in contracts

-- Add location tracking fields to contract_risk_findings
ALTER TABLE contract_risk_findings
ADD COLUMN IF NOT EXISTS page_number INTEGER,
ADD COLUMN IF NOT EXISTS location_start INTEGER,
ADD COLUMN IF NOT EXISTS location_end INTEGER,
ADD COLUMN IF NOT EXISTS quoted_text TEXT;

-- Create contract annotations table
CREATE TABLE IF NOT EXISTS contract_annotations (
  id SERIAL PRIMARY KEY,
  contract_review_id INTEGER NOT NULL REFERENCES contract_reviews(id) ON DELETE CASCADE,

  -- Annotation type: strikethrough, comment, highlight, note
  annotation_type VARCHAR(50) NOT NULL CHECK (annotation_type IN ('strikethrough', 'comment', 'highlight', 'note')),

  -- Location in document
  page_number INTEGER,
  location_start INTEGER,
  location_end INTEGER,
  quoted_text TEXT,

  -- Annotation content
  content TEXT,
  color VARCHAR(50) DEFAULT 'red',

  -- Link to risk finding (optional)
  risk_finding_id INTEGER REFERENCES contract_risk_findings(id) ON DELETE SET NULL,

  -- User tracking
  created_by INTEGER REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_annotations_contract ON contract_annotations(contract_review_id);
CREATE INDEX IF NOT EXISTS idx_annotations_finding ON contract_annotations(risk_finding_id);
CREATE INDEX IF NOT EXISTS idx_annotations_created_by ON contract_annotations(created_by);
CREATE INDEX IF NOT EXISTS idx_findings_location ON contract_risk_findings(page_number, location_start);

-- Add update trigger for annotations
DROP TRIGGER IF EXISTS update_contract_annotations_updated_at ON contract_annotations;
CREATE TRIGGER update_contract_annotations_updated_at
  BEFORE UPDATE ON contract_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
