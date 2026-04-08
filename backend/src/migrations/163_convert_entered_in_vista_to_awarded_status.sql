-- Convert entered_in_vista boolean to awarded_status text field
-- Values: 'Not in Vista', 'In Progress', 'Completed'
-- Only relevant when stage = Awarded

-- Add new column
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS awarded_status VARCHAR(20);

-- Migrate existing data
UPDATE opportunities SET awarded_status = CASE
  WHEN entered_in_vista = true THEN 'Completed'
  ELSE NULL
END WHERE entered_in_vista IS NOT NULL;

-- Drop old column
ALTER TABLE opportunities DROP COLUMN IF EXISTS entered_in_vista;
