-- Migration 252: Risk & Opportunities log for Cost Control Matrix
CREATE TABLE IF NOT EXISTS cost_control_risk_items (
  id           SERIAL PRIMARY KEY,
  matrix_id    INTEGER NOT NULL REFERENCES cost_control_matrices(id) ON DELETE CASCADE,
  version_id   INTEGER REFERENCES cost_control_versions(id) ON DELETE SET NULL,
  type         VARCHAR(20) NOT NULL DEFAULT 'risk'
               CHECK (type IN ('risk', 'opportunity')),
  description  TEXT NOT NULL DEFAULT '',
  probability  NUMERIC(5,2) DEFAULT NULL,   -- 0-100 (percent)
  impact       NUMERIC(15,2) DEFAULT NULL,  -- always positive dollar amount
  status       VARCHAR(20) NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'realized', 'mitigated', 'closed')),
  notes        TEXT DEFAULT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_risk_items_matrix ON cost_control_risk_items(matrix_id);
