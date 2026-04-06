-- Fix campaign_company source values.
-- The original backfill (migration 148) used a timestamp heuristic that was unreliable.
-- Companies added individually through the UI all got source='manual', even initial setup ones.
--
-- Better heuristic: for each campaign, find when the first campaign_week was created
-- (i.e., when the campaign was "generated"). Companies created on or before that date
-- are originals ('seed'). Companies created after are additions ('manual').
-- If a campaign has no weeks, all its companies are 'seed' (still in setup).

-- Step 1: Reset everything to 'seed'
UPDATE campaign_companies SET source = 'seed';

-- Step 2: Mark as 'manual' only companies created AFTER the campaign was generated
UPDATE campaign_companies cc
SET source = 'manual'
FROM (
  SELECT campaign_id, MIN(created_at) as generated_at
  FROM campaign_weeks
  GROUP BY campaign_id
) cw
WHERE cc.campaign_id = cw.campaign_id
  AND cc.created_at > cw.generated_at;
