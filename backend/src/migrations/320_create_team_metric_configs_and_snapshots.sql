-- Team metric configs: which (member + metric) rows to display on the Metrics tab
CREATE TABLE IF NOT EXISTS team_metric_configs (
  id            SERIAL PRIMARY KEY,
  team_id       INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tenant_id     INTEGER NOT NULL,
  member_user_id INTEGER NULL,  -- NULL means whole-team aggregate
  metric_key    VARCHAR(50) NOT NULL,
  label         VARCHAR(100) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, member_user_id, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_team_metric_configs_team ON team_metric_configs(team_id);

-- Team metric snapshots: weekly value per config row
CREATE TABLE IF NOT EXISTS team_metric_snapshots (
  id              SERIAL PRIMARY KEY,
  team_id         INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tenant_id       INTEGER NOT NULL,
  member_user_id  INTEGER NULL,
  metric_key      VARCHAR(50) NOT NULL,
  week_start      DATE NOT NULL,       -- Monday of the week
  value           NUMERIC(20, 4),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, member_user_id, metric_key, week_start)
);

CREATE INDEX IF NOT EXISTS idx_team_metric_snapshots_lookup
  ON team_metric_snapshots(team_id, week_start DESC);
