-- Create weekly_goal_tasks table for individual daily tasks within weekly plans
CREATE TABLE IF NOT EXISTS weekly_goal_tasks (
  id SERIAL PRIMARY KEY,
  weekly_goal_plan_id INTEGER NOT NULL REFERENCES weekly_goal_plans(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Task details
  trade VARCHAR(50) NOT NULL CHECK (trade IN ('plumbing', 'piping', 'sheet_metal')),
  task_date DATE NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2),
  unit VARCHAR(50),

  -- Status tracking
  status VARCHAR(50) DEFAULT 'incomplete' CHECK (status IN ('complete', 'incomplete')),
  incomplete_reason VARCHAR(100) CHECK (incomplete_reason IN ('weather', 'materials', 'equipment', 'labor', 'gc_delay', 'other_trade', 'other')),
  incomplete_notes TEXT,

  -- Hours tracking
  actual_hours DECIMAL(5,2) DEFAULT 0,

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_plan ON weekly_goal_tasks(weekly_goal_plan_id);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_tenant ON weekly_goal_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_trade ON weekly_goal_tasks(trade);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_date ON weekly_goal_tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_status ON weekly_goal_tasks(status);

-- Comment for documentation
COMMENT ON TABLE weekly_goal_tasks IS 'Daily tasks for weekly goal plans with completion tracking and incomplete reasons';
