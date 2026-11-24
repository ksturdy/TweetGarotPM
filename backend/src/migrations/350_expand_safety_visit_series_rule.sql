-- Store the full recurrence rule as JSONB so we can support any pattern
-- without future column migrations.
ALTER TABLE safety_visit_series
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;
