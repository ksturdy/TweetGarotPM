-- Weekly report snapshot history for week-over-week comparisons
CREATE TABLE IF NOT EXISTS weekly_report_snapshots (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  week_start DATE NOT NULL,
  total_backlog NUMERIC,
  backlog_6mo NUMERIC,
  backlog_6mo_gm_pct NUMERIC,
  backlog_12mo NUMERIC,
  backlog_12mo_gm_pct NUMERIC,
  weighted_gm_pct NUMERIC,
  avg_project_gm_pct NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, week_start)
);
