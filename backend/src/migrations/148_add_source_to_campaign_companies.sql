-- Migration 148: Add source column to campaign_companies
-- Tracks whether a prospect was part of the original campaign list ('seed')
-- or added manually during the campaign ('manual')

ALTER TABLE campaign_companies
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'seed';

-- Backfill: for each campaign, companies NOT created in the first bulk batch
-- (i.e., created later than the earliest company in that campaign) are 'manual'
UPDATE campaign_companies cc
SET source = 'manual'
FROM (
  SELECT campaign_id, MIN(created_at) as first_batch_time
  FROM campaign_companies
  GROUP BY campaign_id
) fb
WHERE cc.campaign_id = fb.campaign_id
  AND cc.created_at > fb.first_batch_time;
