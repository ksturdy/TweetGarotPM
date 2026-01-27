-- Migration: Add facility_name to opportunities table
-- Allows storing a facility/location name for an opportunity

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS facility_name VARCHAR(255);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS facility_customer_id INTEGER REFERENCES customers(id);

-- Add comment
COMMENT ON COLUMN opportunities.facility_name IS 'Facility or location name for the opportunity';
COMMENT ON COLUMN opportunities.facility_customer_id IS 'Reference to customer record for facility linking';
