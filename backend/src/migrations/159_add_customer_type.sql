-- Add customer_type to distinguish real customers from prospects
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type VARCHAR(20) DEFAULT 'customer';

-- Backfill existing rows
UPDATE customers SET customer_type = 'customer' WHERE customer_type IS NULL;

-- Add check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_customer_type'
  ) THEN
    ALTER TABLE customers ADD CONSTRAINT chk_customer_type
      CHECK (customer_type IN ('customer', 'prospect'));
  END IF;
END $$;

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);
