-- Create daily_trade_actuals table for tracking actual daily crew and hours per trade
CREATE TABLE IF NOT EXISTS daily_trade_actuals (
  id SERIAL PRIMARY KEY,
  weekly_goal_plan_id INTEGER NOT NULL REFERENCES weekly_goal_plans(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Date and trade info
  work_date DATE NOT NULL,
  trade VARCHAR(20) NOT NULL CHECK (trade IN ('plumbing', 'piping', 'sheet_metal')),

  -- Actual values entered by foreman
  actual_crew_size INTEGER DEFAULT 0,
  actual_hours_worked DECIMAL(10, 2) DEFAULT 0,

  -- Optional notes
  notes TEXT,

  -- Metadata
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one record per day per trade per plan
  UNIQUE(weekly_goal_plan_id, work_date, trade)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_trade_actuals_plan ON daily_trade_actuals(weekly_goal_plan_id);
CREATE INDEX IF NOT EXISTS idx_daily_trade_actuals_date ON daily_trade_actuals(work_date);
CREATE INDEX IF NOT EXISTS idx_daily_trade_actuals_tenant ON daily_trade_actuals(tenant_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_daily_trade_actuals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_daily_trade_actuals_timestamp
  BEFORE UPDATE ON daily_trade_actuals
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_trade_actuals_updated_at();
