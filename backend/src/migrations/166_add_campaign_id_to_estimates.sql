-- Add campaign_id to estimates table for campaign attribution
-- Mirrors the existing campaign_id on opportunities (migration 035)

ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimates_campaign_id ON estimates(campaign_id);
