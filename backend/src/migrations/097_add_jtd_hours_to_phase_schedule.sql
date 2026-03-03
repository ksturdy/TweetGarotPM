-- Add total_jtd_hours column to phase_schedule_items
ALTER TABLE phase_schedule_items ADD COLUMN IF NOT EXISTS total_jtd_hours NUMERIC(12,2) DEFAULT 0;
