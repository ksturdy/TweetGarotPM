-- Migration: Add weather and temperature to safety_observations

ALTER TABLE safety_observations
  ADD COLUMN IF NOT EXISTS weather VARCHAR(100),
  ADD COLUMN IF NOT EXISTS temperature SMALLINT;
