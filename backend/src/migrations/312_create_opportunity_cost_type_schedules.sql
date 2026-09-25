-- Migration 312: Create opportunity_cost_type_schedules table
-- Stores per-cost-type date ranges for the opportunity Schedule tab

CREATE TABLE IF NOT EXISTS opportunity_cost_type_schedules (
  id SERIAL PRIMARY KEY,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cost_type SMALLINT NOT NULL CHECK (cost_type BETWEEN 1 AND 6),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(opportunity_id, cost_type)
);

CREATE INDEX IF NOT EXISTS idx_opp_ct_sched_opp ON opportunity_cost_type_schedules(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_ct_sched_tenant ON opportunity_cost_type_schedules(tenant_id);

CREATE TRIGGER update_opp_ct_sched_updated_at
  BEFORE UPDATE ON opportunity_cost_type_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
