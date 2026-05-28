-- Add Previous Gross Profit columns from Vista Contracts upload
-- Source columns: "Previous Gross Profit" (BN), "Previous Gross Profit Margin" (BO)

ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS prev_gross_profit_dollars DECIMAL(15,2);
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS prev_gross_profit_percent DECIMAL(8,4);

COMMENT ON COLUMN vp_contracts.prev_gross_profit_dollars IS 'Previous Gross Profit ($) from prior Vista snapshot';
COMMENT ON COLUMN vp_contracts.prev_gross_profit_percent IS 'Previous Gross Profit Margin (%) from prior Vista snapshot';
