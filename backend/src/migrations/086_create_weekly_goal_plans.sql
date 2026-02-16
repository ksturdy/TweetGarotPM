-- Create weekly_goal_plans table for tracking weekly construction goals by trade
CREATE TABLE IF NOT EXISTS weekly_goal_plans (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Week identification
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  include_sunday BOOLEAN DEFAULT FALSE,

  -- Plumbing trade
  plumbing_foreman VARCHAR(255),
  plumbing_crew_size INTEGER DEFAULT 0,
  plumbing_hours_per_day DECIMAL(5,2) DEFAULT 0,
  plumbing_days_worked INTEGER DEFAULT 0,
  plumbing_planned_hours DECIMAL(8,2) DEFAULT 0,
  plumbing_actual_hours DECIMAL(8,2) DEFAULT 0,

  -- Piping trade
  piping_foreman VARCHAR(255),
  piping_crew_size INTEGER DEFAULT 0,
  piping_hours_per_day DECIMAL(5,2) DEFAULT 0,
  piping_days_worked INTEGER DEFAULT 0,
  piping_planned_hours DECIMAL(8,2) DEFAULT 0,
  piping_actual_hours DECIMAL(8,2) DEFAULT 0,

  -- Sheet Metal trade
  sheet_metal_foreman VARCHAR(255),
  sheet_metal_crew_size INTEGER DEFAULT 0,
  sheet_metal_hours_per_day DECIMAL(5,2) DEFAULT 0,
  sheet_metal_days_worked INTEGER DEFAULT 0,
  sheet_metal_planned_hours DECIMAL(8,2) DEFAULT 0,
  sheet_metal_actual_hours DECIMAL(8,2) DEFAULT 0,

  -- Metadata
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(project_id, week_start_date)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_weekly_goals_project ON weekly_goal_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_weekly_goals_tenant ON weekly_goal_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_weekly_goals_week ON weekly_goal_plans(week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_goals_status ON weekly_goal_plans(status);

-- Comment for documentation
COMMENT ON TABLE weekly_goal_plans IS 'Weekly construction goal plans tracking planned vs actual hours for 3 trades';
