-- Add scheduling mode to projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS scheduling_mode VARCHAR(20) NOT NULL DEFAULT 'summary'
CHECK (scheduling_mode IN ('summary', 'cost_type', 'phase'));

-- Store per-segment (trade/cost-type) date windows for cost_type scheduling mode
CREATE TABLE IF NOT EXISTS project_schedule_segments (
  id           SERIAL PRIMARY KEY,
  project_id   INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id    INT NOT NULL,
  segment_key  VARCHAR(20) NOT NULL,
  label        VARCHAR(50) NOT NULL,
  start_date   DATE,
  end_date     DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, segment_key)
);

CREATE INDEX IF NOT EXISTS idx_project_schedule_segments_project
  ON project_schedule_segments (project_id, tenant_id);
