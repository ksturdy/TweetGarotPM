-- Add percent_complete column to phase_schedule_items (PM-entered, bidirectional with quantities)
ALTER TABLE phase_schedule_items ADD COLUMN IF NOT EXISTS percent_complete NUMERIC(8,4) DEFAULT 0;
