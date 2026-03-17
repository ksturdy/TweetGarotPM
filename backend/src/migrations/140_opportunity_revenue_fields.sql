-- Migration: Add revenue projection fields to opportunities table
-- Enables opportunity revenue grid with work contours and smart start date management

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS contour_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS user_adjusted_start_date DATE,
  ADD COLUMN IF NOT EXISTS user_adjusted_duration_months INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_end_date DATE;

COMMENT ON COLUMN opportunities.contour_type IS 'User-selected work contour for revenue distribution (flat, bell, scurve, etc.)';
COMMENT ON COLUMN opportunities.user_adjusted_start_date IS 'Manual override for projected start date (overrides stale estimated_start_date)';
COMMENT ON COLUMN opportunities.user_adjusted_duration_months IS 'Manual override for work duration in months';
COMMENT ON COLUMN opportunities.estimated_end_date IS 'Alternative to estimated_duration_days - explicit end date';
