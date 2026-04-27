-- Migration 179: Per-project KPI goal targets
-- Stores configurable goal thresholds for project health KPI cards

CREATE TABLE IF NOT EXISTS project_goals (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),

  cash_flow_goal_pct NUMERIC(8,4),      -- target cash flow as % of contract value (e.g., 0.05 = 5%)
  margin_goal_pct NUMERIC(8,4),          -- target gross margin % (e.g., 0.15 = 15%)
  shop_hours_goal_pct NUMERIC(8,4),      -- target shop hours as % of total (e.g., 0.30 = 30%)
  labor_rate_goal NUMERIC(10,2),         -- target labor rate $/hr (e.g., 55.00)

  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_goals_project ON project_goals(project_id);
CREATE INDEX IF NOT EXISTS idx_project_goals_tenant ON project_goals(tenant_id);
