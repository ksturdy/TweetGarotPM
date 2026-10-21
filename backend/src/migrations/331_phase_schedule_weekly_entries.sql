CREATE TABLE phase_schedule_weekly_entries (
  id                      SERIAL PRIMARY KEY,
  project_id              INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id               INTEGER NOT NULL REFERENCES tenants(id),
  phase_schedule_item_id  INTEGER NOT NULL REFERENCES phase_schedule_items(id) ON DELETE CASCADE,
  week_ending             DATE NOT NULL,
  qty_installed           NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes                   TEXT,
  created_by              INTEGER REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (phase_schedule_item_id, week_ending)
);

CREATE INDEX idx_pswe_project ON phase_schedule_weekly_entries (project_id, tenant_id);
CREATE INDEX idx_pswe_item     ON phase_schedule_weekly_entries (phase_schedule_item_id);
