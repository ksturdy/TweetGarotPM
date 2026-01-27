-- Add customer_id to opportunities table for linking opportunities to customers

-- Add the customer_id column
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_opportunities_customer ON opportunities(customer_id);

-- Add comment for clarity
COMMENT ON COLUMN opportunities.customer_id IS 'Optional link to a customer in the customers table';
