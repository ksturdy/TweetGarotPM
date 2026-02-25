-- Fix percentage column precision in project_snapshots table
-- These need to match vp_contracts table which uses DECIMAL(8,4)

ALTER TABLE project_snapshots
  ALTER COLUMN gross_profit_percent TYPE DECIMAL(8, 4);

ALTER TABLE project_snapshots
  ALTER COLUMN original_estimated_margin_pct TYPE DECIMAL(8, 4);

-- Comment
COMMENT ON COLUMN project_snapshots.gross_profit_percent IS 'Gross profit percentage (DECIMAL(8,4) to match vp_contracts)';
COMMENT ON COLUMN project_snapshots.original_estimated_margin_pct IS 'Original estimated margin percentage (DECIMAL(8,4) to match vp_contracts)';
