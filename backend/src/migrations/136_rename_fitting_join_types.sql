-- Migration: Rename fitting and join types to canonical naming
-- Aligns Titan PM's existing data with Titan Takeoff's naming conventions

-- Update fitting types in piping_productivity_rates
UPDATE piping_productivity_rates SET fitting_type = 'elbow_90' WHERE fitting_type = '90_elbow';
UPDATE piping_productivity_rates SET fitting_type = 'elbow_45' WHERE fitting_type = '45_elbow';

-- Update fitting types in takeoff_items
UPDATE takeoff_items SET fitting_type = 'elbow_90' WHERE fitting_type = '90_elbow';
UPDATE takeoff_items SET fitting_type = 'elbow_45' WHERE fitting_type = '45_elbow';

-- Update join types in piping_productivity_rates
UPDATE piping_productivity_rates SET join_type = 'press_fit' WHERE join_type = 'press';
UPDATE piping_productivity_rates SET join_type = 'solvent_weld' WHERE join_type = 'glued';

-- Update join types in takeoff_items
UPDATE takeoff_items SET join_type = 'press_fit' WHERE join_type = 'press';
UPDATE takeoff_items SET join_type = 'solvent_weld' WHERE join_type = 'glued';

-- Add takeoff_type column to takeoffs table
ALTER TABLE takeoffs ADD COLUMN IF NOT EXISTS takeoff_type VARCHAR(20) DEFAULT 'manual'
  CHECK (takeoff_type IN ('manual', 'traceover'));

-- Add pipe_spec_id to takeoffs (optional link to a default pipe spec)
ALTER TABLE takeoffs ADD COLUMN IF NOT EXISTS pipe_spec_id INTEGER REFERENCES pipe_specs(id);
