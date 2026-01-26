-- Add market column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS market VARCHAR(255);

-- Create index for market field
CREATE INDEX IF NOT EXISTS idx_customers_market ON customers(market);
