-- Migration 315: make cost_type nullable
-- Migration 314 switched to segment_key but left NOT NULL on cost_type,
-- causing every new upsert to fail. New rows have no cost_type value.
ALTER TABLE opportunity_cost_type_schedules
  ALTER COLUMN cost_type DROP NOT NULL;
