-- Migration: Add project participants fields to estimates table
-- This matches the opportunities module's project participants section

-- Add owner field (company name text input)
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS owner VARCHAR(255);

-- Add general contractor fields
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS general_contractor VARCHAR(255);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS gc_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

-- Add facility fields
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS facility_name VARCHAR(255);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS facility_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

-- Add send estimate to field (links to a company/customer)
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS send_estimate_to INTEGER REFERENCES customers(id) ON DELETE SET NULL;

-- Create indexes for the new foreign keys
CREATE INDEX IF NOT EXISTS idx_estimates_gc_customer_id ON estimates(gc_customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_facility_customer_id ON estimates(facility_customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_send_estimate_to ON estimates(send_estimate_to);
