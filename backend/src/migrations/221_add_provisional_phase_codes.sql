-- Migration 221: Provisional (manually-entered) phase codes.
--   For projects where Vista isn't set up yet but the customer needs a
--   billing forecast, allow users to seed vp_phase_codes rows tagged as
--   provisional. When real Vista data lands later, the reconciliation
--   flow swaps schedule-item references and tombstones the provisional
--   row (reconciled_to_id, reconciled_at) instead of hard-deleting it,
--   so prior forecast snapshots remain auditable.

ALTER TABLE vp_phase_codes
  ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS provisional_notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reconciled_to_id INTEGER REFERENCES vp_phase_codes(id),
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

-- Reconciliation columns only make sense on a provisional row.
ALTER TABLE vp_phase_codes
  DROP CONSTRAINT IF EXISTS vp_phase_codes_reconciliation_chk;
ALTER TABLE vp_phase_codes
  ADD CONSTRAINT vp_phase_codes_reconciliation_chk
  CHECK (
    (reconciled_to_id IS NULL AND reconciled_at IS NULL)
    OR is_provisional = TRUE
  );

-- Hot path: listing provisional rows for a project's reconciliation panel.
CREATE INDEX IF NOT EXISTS idx_vp_phase_codes_provisional
  ON vp_phase_codes (tenant_id, linked_project_id)
  WHERE is_provisional = TRUE AND reconciled_at IS NULL;
