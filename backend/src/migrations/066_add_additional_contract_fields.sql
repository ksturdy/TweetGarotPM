-- Add additional financial fields to vp_contracts from Vista Excel

-- Cost breakdown fields
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS material_jtd DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS material_estimate DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS material_projected DECIMAL(15,2);

ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS subcontracts_jtd DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS subcontracts_estimate DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS subcontracts_projected DECIMAL(15,2);

ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS rentals_jtd DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS rentals_estimate DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS rentals_projected DECIMAL(15,2);

ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS mep_equip_jtd DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS mep_equip_estimate DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS mep_equip_projected DECIMAL(15,2);

-- Plumber hours (PL = Plumber trade)
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS pl_hours_estimate DECIMAL(10,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS pl_hours_jtd DECIMAL(10,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS pl_hours_projected DECIMAL(10,2);

-- Projected hours for other trades
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS pf_hours_projected DECIMAL(10,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS sm_hours_projected DECIMAL(10,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS total_hours_projected DECIMAL(10,2);

-- Financial metrics
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS cash_flow DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS gross_profit_dollars DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS open_receivables DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS current_est_cost DECIMAL(15,2);

-- Change order tracking
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS pending_change_orders DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS approved_changes DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS change_order_count INTEGER;

-- Original margin tracking
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS original_estimated_margin DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS original_estimated_margin_pct DECIMAL(8,4);

-- Labor rates
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS actual_labor_rate DECIMAL(10,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS estimated_labor_rate DECIMAL(10,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS current_est_labor_cost DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS ttl_labor_projected DECIMAL(15,2);

-- Dates
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS start_month DATE;
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS month_closed DATE;

-- Add comments
COMMENT ON COLUMN vp_contracts.pl_hours_jtd IS 'Plumber hours job-to-date';
COMMENT ON COLUMN vp_contracts.pl_hours_estimate IS 'Plumber hours estimate';
COMMENT ON COLUMN vp_contracts.cash_flow IS 'Cash flow (received - cost)';
COMMENT ON COLUMN vp_contracts.gross_profit_dollars IS 'Gross profit in dollars';
COMMENT ON COLUMN vp_contracts.open_receivables IS 'Outstanding accounts receivable';
COMMENT ON COLUMN vp_contracts.pending_change_orders IS 'Value of pending change orders';
COMMENT ON COLUMN vp_contracts.approved_changes IS 'Value of approved changes';
COMMENT ON COLUMN vp_contracts.change_order_count IS 'Number of change orders';
