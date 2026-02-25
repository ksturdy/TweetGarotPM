-- Create project_snapshots table for historical performance tracking
-- Captures Vista financial data at regular intervals (weekly on Wednesdays)

CREATE TABLE IF NOT EXISTS project_snapshots (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,

  -- Contract Values
  orig_contract_amount DECIMAL(15, 2),
  contract_amount DECIMAL(15, 2),
  approved_changes DECIMAL(15, 2),
  pending_change_orders DECIMAL(15, 2),
  change_order_count INTEGER,

  -- Revenue & Progress
  projected_revenue DECIMAL(15, 2),
  earned_revenue DECIMAL(15, 2),
  backlog DECIMAL(15, 2),
  percent_complete DECIMAL(5, 4),

  -- Margin
  gross_profit_dollars DECIMAL(15, 2),
  gross_profit_percent DECIMAL(5, 4),
  original_estimated_margin DECIMAL(15, 2),
  original_estimated_margin_pct DECIMAL(5, 4),

  -- Billing & AR
  billed_amount DECIMAL(15, 2),
  received_amount DECIMAL(15, 2),
  open_receivables DECIMAL(15, 2),
  cash_flow DECIMAL(15, 2),

  -- Costs
  actual_cost DECIMAL(15, 2),
  projected_cost DECIMAL(15, 2),
  current_est_cost DECIMAL(15, 2),

  -- Labor
  actual_labor_rate DECIMAL(10, 2),
  estimated_labor_rate DECIMAL(10, 2),
  current_est_labor_cost DECIMAL(15, 2),
  ttl_labor_projected DECIMAL(15, 2),

  -- Material
  material_estimate DECIMAL(15, 2),
  material_jtd DECIMAL(15, 2),
  material_projected DECIMAL(15, 2),

  -- Subcontracts
  subcontracts_estimate DECIMAL(15, 2),
  subcontracts_jtd DECIMAL(15, 2),
  subcontracts_projected DECIMAL(15, 2),

  -- Rentals
  rentals_estimate DECIMAL(15, 2),
  rentals_jtd DECIMAL(15, 2),
  rentals_projected DECIMAL(15, 2),

  -- MEP Equipment
  mep_equip_estimate DECIMAL(15, 2),
  mep_equip_jtd DECIMAL(15, 2),
  mep_equip_projected DECIMAL(15, 2),

  -- Hours - Pipefitter
  pf_hours_estimate DECIMAL(10, 2),
  pf_hours_jtd DECIMAL(10, 2),
  pf_hours_projected DECIMAL(10, 2),

  -- Hours - Sheet Metal
  sm_hours_estimate DECIMAL(10, 2),
  sm_hours_jtd DECIMAL(10, 2),
  sm_hours_projected DECIMAL(10, 2),

  -- Hours - Plumbing
  pl_hours_estimate DECIMAL(10, 2),
  pl_hours_jtd DECIMAL(10, 2),
  pl_hours_projected DECIMAL(10, 2),

  -- Hours - Total
  total_hours_estimate DECIMAL(10, 2),
  total_hours_jtd DECIMAL(10, 2),
  total_hours_projected DECIMAL(10, 2),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),

  -- Ensure one snapshot per project per date
  UNIQUE (project_id, snapshot_date)
);

-- Index for efficient queries
CREATE INDEX idx_project_snapshots_project ON project_snapshots(project_id);
CREATE INDEX idx_project_snapshots_date ON project_snapshots(snapshot_date);
CREATE INDEX idx_project_snapshots_tenant ON project_snapshots(tenant_id);

-- Comment
COMMENT ON TABLE project_snapshots IS 'Historical snapshots of project financial data captured weekly on Wednesdays for performance trend analysis';
