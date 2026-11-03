CREATE TABLE IF NOT EXISTS team_annual_goals (
  id           SERIAL PRIMARY KEY,
  team_id      INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tenant_id    INTEGER NOT NULL,
  year         INTEGER NOT NULL,
  revenue_goal NUMERIC(20,2),
  margin_goal  NUMERIC(5,2),
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE (team_id, year)
);

CREATE INDEX IF NOT EXISTS idx_team_annual_goals_team ON team_annual_goals(team_id, tenant_id);
