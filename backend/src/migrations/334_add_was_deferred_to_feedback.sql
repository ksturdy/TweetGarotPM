-- Track whether a feedback item was ever placed on hold or marked as future enhancement
-- Used to exclude these items from the avg fix time KPI
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS was_deferred BOOLEAN NOT NULL DEFAULT false;
