-- Migration 160: Create customer_locations table and swap facility_customer_id → facility_location_id
-- Facility/Location is now a child record of a customer, not a global company reference

-- 1. Create customer_locations table
CREATE TABLE IF NOT EXISTS customer_locations (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  notes TEXT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_locations_customer_id ON customer_locations(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_locations_tenant_id ON customer_locations(tenant_id);

-- 2. Add facility_location_id to opportunities and estimates
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS facility_location_id INTEGER REFERENCES customer_locations(id);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS facility_location_id INTEGER REFERENCES customer_locations(id);

-- 3. Backfill: Create unique location records from existing facility data
--    For opportunities that have a customer_id and a facility_name, create a location under that customer
INSERT INTO customer_locations (customer_id, name, tenant_id)
SELECT DISTINCT
  o.customer_id,
  o.facility_name,
  o.tenant_id
FROM opportunities o
WHERE o.customer_id IS NOT NULL
  AND o.facility_name IS NOT NULL
  AND o.facility_name != '';

-- Same for estimates (skip duplicates that already exist from opportunities backfill)
INSERT INTO customer_locations (customer_id, name, tenant_id)
SELECT DISTINCT
  e.customer_id,
  e.facility_name,
  e.tenant_id
FROM estimates e
WHERE e.customer_id IS NOT NULL
  AND e.facility_name IS NOT NULL
  AND e.facility_name != ''
  AND NOT EXISTS (
    SELECT 1 FROM customer_locations cl
    WHERE cl.customer_id = e.customer_id
      AND cl.name = e.facility_name
      AND cl.tenant_id = e.tenant_id
  );

-- 4. Link existing rows to their new location records
UPDATE opportunities o
SET facility_location_id = cl.id
FROM customer_locations cl
WHERE o.customer_id = cl.customer_id
  AND o.facility_name = cl.name
  AND o.tenant_id = cl.tenant_id
  AND o.customer_id IS NOT NULL
  AND o.facility_name IS NOT NULL
  AND o.facility_name != '';

UPDATE estimates e
SET facility_location_id = cl.id
FROM customer_locations cl
WHERE e.customer_id = cl.customer_id
  AND e.facility_name = cl.name
  AND e.tenant_id = cl.tenant_id
  AND e.customer_id IS NOT NULL
  AND e.facility_name IS NOT NULL
  AND e.facility_name != '';

-- 5. Drop the old facility_customer_id columns (replaced by facility_location_id)
ALTER TABLE opportunities DROP COLUMN IF EXISTS facility_customer_id;
ALTER TABLE estimates DROP COLUMN IF EXISTS facility_customer_id;
