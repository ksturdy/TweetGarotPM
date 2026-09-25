-- Migration 311: Add margin_pct to opportunity_estimates
-- Stores gross margin percentage so cost breakdown reflects cost, not revenue

ALTER TABLE opportunity_estimates
  ADD COLUMN IF NOT EXISTS margin_pct DECIMAL(6,4) DEFAULT 0;
