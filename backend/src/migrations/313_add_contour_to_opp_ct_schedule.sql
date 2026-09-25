ALTER TABLE opportunity_cost_type_schedules
  ADD COLUMN IF NOT EXISTS contour_type VARCHAR(20) DEFAULT 'flat';
