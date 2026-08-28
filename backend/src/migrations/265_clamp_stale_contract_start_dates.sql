-- Migration 265: Clamp stale vp_contracts start dates to current month
--
-- Problem: Projects with multiple sub-job contracts (e.g. 43931-10/20/30/40) had some
-- sub-jobs that were never adjusted via the Labor Forecast. Those sub-jobs kept their
-- original project start dates (e.g. May 2025), which caused getProjectEffectiveDates()
-- to return that old date via MIN(user_adjusted_start_date). The Labor Forecast clamps
-- past offsets to 0 (= current month), so the two views disagreed.
--
-- Fix: Update any user_adjusted_start_date that is before the current month to the
-- first day of the current month. This matches the Labor Forecast's clamping behavior
-- and ensures the stored value reflects the actual scheduling intent.

UPDATE vp_contracts
SET
  user_adjusted_start_date = DATE_TRUNC('month', CURRENT_DATE)::date,
  updated_at = NOW()
WHERE user_adjusted_start_date IS NOT NULL
  AND user_adjusted_start_date < DATE_TRUNC('month', CURRENT_DATE);
