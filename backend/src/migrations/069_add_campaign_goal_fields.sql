-- Migration: Add campaign goal fields
-- Description: Add target goals for touchpoints, opportunities, estimates, and awards to campaigns table

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS target_touchpoints INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_opportunities INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_estimates INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_awards INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_pipeline_value DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_description TEXT;

-- Backfill Phoenix campaign with its known goals
UPDATE campaigns
SET target_touchpoints = 40,
    target_opportunities = 5,
    target_estimates = 3,
    target_awards = 1,
    target_pipeline_value = 500000,
    goal_description = 'Contact 40 high-value prospects and generate 5+ new opportunities'
WHERE name LIKE 'Phoenix Division%';
