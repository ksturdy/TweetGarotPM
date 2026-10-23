-- Add carry_over_statuses to meeting_series so each series can define
-- which action item statuses are carried forward to the next meeting.
ALTER TABLE meeting_series
  ADD COLUMN IF NOT EXISTS carry_over_statuses TEXT[] NOT NULL DEFAULT '{open,in_progress}';
