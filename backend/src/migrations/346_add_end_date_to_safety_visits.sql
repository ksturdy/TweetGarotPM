-- Migration 346: Add end_date to safety_visits for multi-day visit spans
-- scheduled_date = visit start (kept as-is for backward compat)
-- end_date       = last day of visit (null = same day as scheduled_date)
ALTER TABLE safety_visits ADD COLUMN IF NOT EXISTS end_date DATE;
