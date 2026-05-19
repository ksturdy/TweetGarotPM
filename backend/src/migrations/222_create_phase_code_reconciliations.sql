-- Migration 222: Pending reconciliations for provisional phase codes.
--   When a Vista import lands a row matching a provisional code's key
--   (tenant_id, job, cost_type, phase), upsertPhaseCode applies the
--   update but keeps is_provisional = TRUE and writes a row here. The
--   PM reviews each delta and accepts (flip is_provisional FALSE) or
--   rejects (roll back vp_phase_codes from snapshot).

CREATE TABLE IF NOT EXISTS pending_phase_code_reconciliations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  provisional_phase_code_id INTEGER NOT NULL REFERENCES vp_phase_codes(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  vista_import_batch_id INTEGER REFERENCES vp_import_batches(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  decided_at TIMESTAMPTZ,
  decided_by_user_id INTEGER REFERENCES users(id),
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pending_phase_code_reconciliations_status_chk
    CHECK (status IN ('pending', 'accepted', 'rejected'))
);

-- Only one pending reconciliation per provisional row at a time. If a
-- second Vista import arrives while one is open, the existing row gets
-- its import batch updated and the original snapshot is preserved so
-- the PM can still roll all the way back to their typed values.
CREATE UNIQUE INDEX IF NOT EXISTS idx_phase_code_reconciliations_one_pending
  ON pending_phase_code_reconciliations (provisional_phase_code_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_phase_code_reconciliations_tenant_status
  ON pending_phase_code_reconciliations (tenant_id, status);
