-- Add location_group to opportunities for labor forecast bridging
-- Values: NEW, CW, WW, AZ (matching Vista department code prefix groups)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS location_group VARCHAR(10);
