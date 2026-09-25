-- Add segment_key column (mirrors CostTypeSchedule SEGMENT_DEFINITIONS)
ALTER TABLE opportunity_cost_type_schedules
  ADD COLUMN IF NOT EXISTS segment_key VARCHAR(20);

-- Backfill non-labor rows from existing cost_type integers
UPDATE opportunity_cost_type_schedules SET segment_key =
  CASE cost_type
    WHEN 2 THEN 'material'
    WHEN 3 THEN 'subcontract'
    WHEN 4 THEN 'rental'
    WHEN 5 THEN 'equipment'
    WHEN 6 THEN 'gc'
  END
WHERE cost_type IN (2,3,4,5,6) AND segment_key IS NULL;

-- Old generic Labor (cost_type 1) rows had no trade breakdown — delete them
-- (dates will be re-entered per trade on the new schedule)
DELETE FROM opportunity_cost_type_schedules WHERE cost_type = 1;

-- Drop old unique constraint on cost_type
ALTER TABLE opportunity_cost_type_schedules
  DROP CONSTRAINT IF EXISTS opportunity_cost_type_schedules_opportunity_id_cost_type_key;

-- Add unique constraint on segment_key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'opp_ct_sched_seg_unique'
  ) THEN
    ALTER TABLE opportunity_cost_type_schedules
      ADD CONSTRAINT opp_ct_sched_seg_unique UNIQUE(opportunity_id, segment_key);
  END IF;
END $$;
