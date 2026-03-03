-- Migration: Allow assessments on campaign companies (not just customers)
-- Created: 2026-03-03

-- Make customer_id nullable so assessments can be linked to campaign companies
ALTER TABLE customer_assessments ALTER COLUMN customer_id DROP NOT NULL;

-- Add campaign_company_id column
ALTER TABLE customer_assessments ADD COLUMN IF NOT EXISTS campaign_company_id INTEGER REFERENCES campaign_companies(id) ON DELETE CASCADE;

-- Add check constraint: one of customer_id or campaign_company_id must be set
ALTER TABLE customer_assessments ADD CONSTRAINT assessment_has_entity
  CHECK (customer_id IS NOT NULL OR campaign_company_id IS NOT NULL);

-- Index for campaign company lookups
CREATE INDEX IF NOT EXISTS idx_customer_assessments_campaign_company_id
  ON customer_assessments(campaign_company_id) WHERE campaign_company_id IS NOT NULL;
