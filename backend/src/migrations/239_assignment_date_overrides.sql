-- Migration 239: Add per-field override flags to project_assignments so the
-- Labor module can distinguish system-defaulted dates (inherited from the
-- project's effective end-date) from dates the user explicitly set.
-- Mirrors the override pattern used by the Labor / Revenue Forecast modules
-- (vp_contracts.user_adjusted_end_date NULL = use computed default).

ALTER TABLE project_assignments
  ADD COLUMN IF NOT EXISTS start_date_overridden BOOLEAN DEFAULT FALSE;
ALTER TABLE project_assignments
  ADD COLUMN IF NOT EXISTS end_date_overridden BOOLEAN DEFAULT FALSE;

-- The 20 backfilled foreman rows currently have start_date = assigned_at::date
-- and end_date = NULL. Those values came from the system, not the user, so
-- both flags must stay FALSE. A follow-up script (run after this migration)
-- will populate end_date from the project's effective end date.
