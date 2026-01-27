-- Add gross margin fields to estimates table
-- AF211 = Gross Margin Dollars, AH211 = Total Cell Price

ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS gross_margin_dollars DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_margin_percentage DECIMAL(5, 2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN estimates.gross_margin_dollars IS 'Gross margin in dollars from Excel bid form (cell AF211)';
COMMENT ON COLUMN estimates.gross_margin_percentage IS 'Gross margin percentage calculated from AF211/AH211';
