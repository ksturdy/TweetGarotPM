-- Convert labor forecast / projected revenue overrides from month offsets to absolute dates.
--
-- Background: user_adjusted_start_months / user_adjusted_end_months stored an integer
-- offset relative to "now". When the calendar rolled over to a new month, every
-- saved offset silently shifted forward by one month, so users' manually-entered
-- start/end dates drifted later by a month on the first of each month.
--
-- Fix: switch to absolute DATE columns. Backfill by anchoring existing offsets to
-- the current month (start_of_month(CURRENT_DATE) + N months). This freezes what
-- users currently see in the dropdowns into absolute dates, so the migration is
-- visually a no-op at the moment it runs.

ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS user_adjusted_start_date DATE;
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS user_adjusted_end_date DATE;

UPDATE vp_contracts
SET user_adjusted_start_date = (date_trunc('month', CURRENT_DATE) + (user_adjusted_start_months || ' months')::interval)::date
WHERE user_adjusted_start_months IS NOT NULL
  AND user_adjusted_start_date IS NULL;

UPDATE vp_contracts
SET user_adjusted_end_date = (date_trunc('month', CURRENT_DATE) + (user_adjusted_end_months || ' months')::interval)::date
WHERE user_adjusted_end_months IS NOT NULL
  AND user_adjusted_end_date IS NULL;

ALTER TABLE vp_contracts DROP COLUMN IF EXISTS user_adjusted_start_months;
ALTER TABLE vp_contracts DROP COLUMN IF EXISTS user_adjusted_end_months;
