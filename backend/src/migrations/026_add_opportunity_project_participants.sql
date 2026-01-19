-- Add project participant fields to opportunities table

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS market VARCHAR(100),
  ADD COLUMN IF NOT EXISTS owner VARCHAR(255),
  ADD COLUMN IF NOT EXISTS general_contractor VARCHAR(255),
  ADD COLUMN IF NOT EXISTS architect VARCHAR(255),
  ADD COLUMN IF NOT EXISTS engineer VARCHAR(255);

-- Add index for market field for filtering/reporting
CREATE INDEX IF NOT EXISTS idx_opportunities_market ON opportunities(market);
