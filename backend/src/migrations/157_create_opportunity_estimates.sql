-- Migration 157: Create opportunity_estimates table for Titan Estimate panel
-- Stores percentage breakdowns and labor rates for opportunity cost estimation

CREATE TABLE IF NOT EXISTS opportunity_estimates (
  id SERIAL PRIMARY KEY,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Cost type percentages (stored as decimals, e.g. 0.35 = 35%)
  labor_pct DECIMAL(6,4) DEFAULT 0,
  material_pct DECIMAL(6,4) DEFAULT 0,
  subcontracts_pct DECIMAL(6,4) DEFAULT 0,
  rentals_pct DECIMAL(6,4) DEFAULT 0,
  mep_equip_pct DECIMAL(6,4) DEFAULT 0,
  general_conditions_pct DECIMAL(6,4) DEFAULT 0,

  -- Trade split within labor (sum should = 1.0)
  pf_labor_pct DECIMAL(6,4) DEFAULT 0,
  sm_labor_pct DECIMAL(6,4) DEFAULT 0,
  pl_labor_pct DECIMAL(6,4) DEFAULT 0,

  -- Shop/Field split per trade (each pair sums to 1.0)
  pf_shop_pct DECIMAL(6,4) DEFAULT 0,
  pf_field_pct DECIMAL(6,4) DEFAULT 0,
  sm_shop_pct DECIMAL(6,4) DEFAULT 0,
  sm_field_pct DECIMAL(6,4) DEFAULT 0,
  pl_shop_pct DECIMAL(6,4) DEFAULT 0,
  pl_field_pct DECIMAL(6,4) DEFAULT 0,

  -- Labor rates used for hour calculations ($/hr)
  pf_labor_rate DECIMAL(10,2) DEFAULT 0,
  sm_labor_rate DECIMAL(10,2) DEFAULT 0,
  pl_labor_rate DECIMAL(10,2) DEFAULT 0,

  -- Metadata
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_opp_estimates_opp ON opportunity_estimates(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_estimates_tenant ON opportunity_estimates(tenant_id);

-- Trigger for updated_at
CREATE TRIGGER update_opportunity_estimates_updated_at
  BEFORE UPDATE ON opportunity_estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
