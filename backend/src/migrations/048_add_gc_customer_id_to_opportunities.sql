-- Add gc_customer_id to opportunities table for linking general contractor to customers

-- Add the gc_customer_id column
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS gc_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_opportunities_gc_customer ON opportunities(gc_customer_id);

-- Add comments for clarity
COMMENT ON COLUMN opportunities.customer_id IS 'Optional link to customer/owner in the customers table';
COMMENT ON COLUMN opportunities.gc_customer_id IS 'Optional link to general contractor in the customers table';
