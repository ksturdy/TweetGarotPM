-- Migration 147: Rebuild customers for Vista sync
-- Adds name column, source tracking, consolidates duplicates, clears stale related data
-- Vista becomes the authoritative source for customer records going forward

-- Step 1: Add new columns
ALTER TABLE customers ADD COLUMN IF NOT EXISTS name VARCHAR(500);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vp_customer_id INTEGER;

-- Step 2: Populate name from VP data (linked customers) or existing fields
UPDATE customers c
SET name = COALESCE(
  (SELECT vpc.name FROM vp_customers vpc WHERE vpc.linked_customer_id = c.id LIMIT 1),
  c.customer_owner,
  c.customer_facility,
  'Unknown'
);

-- Step 3: Populate customer_number from linked VP records
UPDATE customers c
SET customer_number = vpc.customer_number::text
FROM vp_customers vpc
WHERE vpc.linked_customer_id = c.id
  AND (c.customer_number IS NULL OR c.customer_number = '');

-- Step 4: Sync address and active status from VP for linked customers
UPDATE customers c
SET
  address = COALESCE(NULLIF(vpc.address, ''), c.address),
  city = COALESCE(NULLIF(vpc.city, ''), c.city),
  state = COALESCE(NULLIF(vpc.state, ''), c.state),
  zip_code = COALESCE(NULLIF(vpc.zip, ''), c.zip_code),
  active_customer = vpc.active,
  vp_customer_id = vpc.id,
  source = 'vista',
  updated_at = CURRENT_TIMESTAMP
FROM vp_customers vpc
WHERE vpc.linked_customer_id = c.id;

-- Step 5: Consolidate duplicate customers (same customer_owner, same tenant)
DO $$
DECLARE
  rec RECORD;
  winner_id INTEGER;
  lid INTEGER;
  loser_ids INTEGER[];
BEGIN
  FOR rec IN
    SELECT tenant_id, LOWER(TRIM(customer_owner)) as norm_owner,
           array_agg(id ORDER BY
             CASE WHEN vp_customer_id IS NOT NULL THEN 0 ELSE 1 END,
             id
           ) as ids
    FROM customers
    WHERE customer_owner IS NOT NULL AND TRIM(customer_owner) != ''
    GROUP BY tenant_id, LOWER(TRIM(customer_owner))
    HAVING COUNT(*) > 1
  LOOP
    winner_id := rec.ids[1];
    loser_ids := rec.ids[2:];

    FOREACH lid IN ARRAY loser_ids LOOP
      -- Re-point all FK references from loser to winner
      UPDATE projects SET customer_id = winner_id WHERE customer_id = lid;
      UPDATE projects SET owner_customer_id = winner_id WHERE owner_customer_id = lid;

      UPDATE estimates SET customer_id = winner_id WHERE customer_id = lid;
      UPDATE estimates SET gc_customer_id = winner_id WHERE gc_customer_id = lid;
      UPDATE estimates SET facility_customer_id = winner_id WHERE facility_customer_id = lid;
      UPDATE estimates SET send_estimate_to = winner_id WHERE send_estimate_to = lid;

      UPDATE opportunities SET customer_id = winner_id WHERE customer_id = lid;
      UPDATE opportunities SET gc_customer_id = winner_id WHERE gc_customer_id = lid;
      UPDATE opportunities SET facility_customer_id = winner_id WHERE facility_customer_id = lid;

      UPDATE vp_contracts SET linked_customer_id = winner_id WHERE linked_customer_id = lid;
      UPDATE vp_work_orders SET linked_customer_id = winner_id WHERE linked_customer_id = lid;
      UPDATE vp_customers SET linked_customer_id = winner_id WHERE linked_customer_id = lid;

      UPDATE proposals SET customer_id = winner_id WHERE customer_id = lid;
      UPDATE case_studies SET customer_id = winner_id WHERE customer_id = lid;

      -- Delete the duplicate (cascades to contacts/touchpoints/assessments)
      DELETE FROM customers WHERE id = lid;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Customer consolidation complete';
END $$;

-- Step 6: Clear related tables (start fresh)
DELETE FROM customer_contacts;
DELETE FROM customer_touchpoints;
DELETE FROM customer_assessments;

-- Step 7: Ensure name is never null
UPDATE customers SET name = COALESCE(customer_owner, customer_facility, 'Unknown') WHERE name IS NULL;
ALTER TABLE customers ALTER COLUMN name SET NOT NULL;

-- Step 8: Add indexes and constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_customer_number
  ON customers(tenant_id, customer_number)
  WHERE customer_number IS NOT NULL AND customer_number != '';

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name ON customers(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);
