-- Add sub-team scope to metric configs and snapshots.
-- member_team_id: when set, the metric aggregates the entire sub-team (e.g. "Alex's Team")
-- member_user_id alone: individual person
-- both null: whole parent team

ALTER TABLE team_metric_configs
  ADD COLUMN IF NOT EXISTS member_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE;

ALTER TABLE team_metric_snapshots
  ADD COLUMN IF NOT EXISTS member_team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE;

-- Drop old unique constraints (they didn't handle NULL properly)
ALTER TABLE team_metric_configs
  DROP CONSTRAINT IF EXISTS team_metric_configs_team_id_member_user_id_metric_key_key;

ALTER TABLE team_metric_snapshots
  DROP CONSTRAINT IF EXISTS team_metric_snapshots_team_id_member_user_id_metric_key_week_key;

-- New expression-based unique indexes using COALESCE so NULLs compare as equal
CREATE UNIQUE INDEX IF NOT EXISTS idx_tmc_scope_unique
  ON team_metric_configs(
    team_id,
    metric_key,
    COALESCE(member_user_id, -1),
    COALESCE(member_team_id, -1)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_tms_scope_unique
  ON team_metric_snapshots(
    team_id,
    metric_key,
    week_start,
    COALESCE(member_user_id, -1),
    COALESCE(member_team_id, -1)
  );

-- Per-team snapshot schedule settings
CREATE TABLE IF NOT EXISTS team_metric_settings (
  team_id             INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  tenant_id           INTEGER NOT NULL,
  snapshot_day_of_week SMALLINT NOT NULL DEFAULT 1,  -- 0=Sun … 6=Sat, default Monday
  snapshot_hour       SMALLINT NOT NULL DEFAULT 18,  -- 24h, default 6 pm
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
