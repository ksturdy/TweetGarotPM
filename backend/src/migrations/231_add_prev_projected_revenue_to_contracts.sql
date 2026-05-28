-- Add Previous Projected Revenue column from Vista Contracts upload (column BQ)

ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS prev_projected_revenue DECIMAL(15,2);

COMMENT ON COLUMN vp_contracts.prev_projected_revenue IS 'Previous Projected Revenue from prior Vista snapshot';
