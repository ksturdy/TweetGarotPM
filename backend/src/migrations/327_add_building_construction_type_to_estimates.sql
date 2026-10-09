-- Migration 327: Add building_type_label and construction_type to estimates
-- building_type column already stores Market; add separate fields for
-- the actual building/facility type and construction type

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS building_type_label VARCHAR(100),
  ADD COLUMN IF NOT EXISTS construction_type VARCHAR(100);
