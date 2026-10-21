CREATE TABLE phase_code_hour_snapshots (
  id                      SERIAL PRIMARY KEY,
  tenant_id               INTEGER NOT NULL REFERENCES tenants(id),
  project_id              INTEGER NOT NULL REFERENCES projects(id),
  phase_schedule_item_id  INTEGER NOT NULL REFERENCES phase_schedule_items(id) ON DELETE CASCADE,
  week_ending             DATE NOT NULL,
  jtd_hours               NUMERIC(12,2) NOT NULL DEFAULT 0,
  jtd_cost                NUMERIC(14,2) NOT NULL DEFAULT 0,
  snapshot_taken_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (phase_schedule_item_id, week_ending)
);

CREATE INDEX idx_pchs_project ON phase_code_hour_snapshots (project_id, tenant_id);
CREATE INDEX idx_pchs_item     ON phase_code_hour_snapshots (phase_schedule_item_id);
