-- Projection notes for the Contract Status Drilldown page.
-- Captures three flavors of input during monthly projections:
--   * note       - free-form context
--   * homework   - assignable action item with due date + open/done status
--   * gain_fade  - signed $ item with optional "recognized in financials" flag
--
-- Notes are anchored to a project and (optionally) to the project_snapshot
-- that captured the projection cycle. Notes can be created BEFORE the snapshot
-- exists (snapshot_id NULL) and then attached when Capture Snapshot runs.

CREATE TABLE IF NOT EXISTS projection_notes (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_id INTEGER REFERENCES project_snapshots(id) ON DELETE SET NULL,

  -- Scope: NULL cost_type = contract-wide, otherwise 1-6 (Labor..GC)
  cost_type INTEGER,
  trade VARCHAR(50),

  type VARCHAR(20) NOT NULL CHECK (type IN ('note', 'homework', 'gain_fade')),
  body TEXT NOT NULL,

  -- Homework fields
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  completed_at TIMESTAMP,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Gain/fade fields
  amount NUMERIC(14, 2),
  recognized_in_financials BOOLEAN NOT NULL DEFAULT false,
  recognized_at DATE,

  -- Audit
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projection_notes_project
  ON projection_notes(project_id, snapshot_id);

CREATE INDEX IF NOT EXISTS idx_projection_notes_tenant
  ON projection_notes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_projection_notes_assigned_open
  ON projection_notes(assigned_to)
  WHERE type = 'homework' AND status = 'open';

CREATE INDEX IF NOT EXISTS idx_projection_notes_unattached
  ON projection_notes(project_id)
  WHERE snapshot_id IS NULL;
