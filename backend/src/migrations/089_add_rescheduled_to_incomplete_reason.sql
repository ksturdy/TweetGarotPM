-- Add 'rescheduled' to the incomplete_reason constraint
ALTER TABLE weekly_goal_tasks
  DROP CONSTRAINT IF EXISTS weekly_goal_tasks_incomplete_reason_check;

ALTER TABLE weekly_goal_tasks
  ADD CONSTRAINT weekly_goal_tasks_incomplete_reason_check
  CHECK (incomplete_reason IN ('rescheduled', 'weather', 'materials', 'equipment', 'labor', 'gc_delay', 'other_trade', 'other'));
