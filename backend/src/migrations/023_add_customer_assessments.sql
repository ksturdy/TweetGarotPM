-- Migration: Add customer Go/No-Go assessment system
-- Created: 2026-01-21

-- Create customer_assessments table for Go/No-Go scoring
CREATE TABLE IF NOT EXISTS customer_assessments (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  total_score INTEGER NOT NULL,
  verdict VARCHAR(20) NOT NULL CHECK (verdict IN ('GO', 'MAYBE', 'NO_GO')),
  tier VARCHAR(20) CHECK (tier IN ('A', 'B', 'C')),
  knockout BOOLEAN DEFAULT FALSE,
  knockout_reason TEXT,
  criteria JSONB NOT NULL,
  notes TEXT,
  assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assessed_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on customer_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_customer_assessments_customer_id ON customer_assessments(customer_id);

-- Create index on verdict for filtering
CREATE INDEX IF NOT EXISTS idx_customer_assessments_verdict ON customer_assessments(verdict);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customer_assessment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_assessment_timestamp
  BEFORE UPDATE ON customer_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_assessment_timestamp();
