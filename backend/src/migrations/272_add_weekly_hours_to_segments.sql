-- Add weekly_hours to store shift schedule (hrs/person/week) per segment.
-- Populated when the user edits the Shift Schedule in the Cost Type tab.
ALTER TABLE project_schedule_segments
  ADD COLUMN IF NOT EXISTS weekly_hours NUMERIC DEFAULT NULL;
