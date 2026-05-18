-- Migration 218: Labor markup % for cost-plus billing on labor lines.
--   Used in $ Billable mode when a labor line has no billable rate assigned —
--   falls back to remCost × (1 + labor markup%). When a rate IS assigned, the
--   rate-pool entry still wins.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS billing_markup_labor NUMERIC(6,3) DEFAULT 0;
