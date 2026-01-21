-- Add campaign_id to opportunities table to link opportunities to campaigns

ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_opportunities_campaign_id ON opportunities(campaign_id);

-- Add comment
COMMENT ON COLUMN opportunities.campaign_id IS 'Optional link to a sales campaign if this opportunity originated from campaign outreach';
