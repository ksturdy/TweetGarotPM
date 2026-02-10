-- Migration: Make customer_id optional in customer_contacts and add tenant_id
-- This allows contacts to exist without being associated with a specific customer

-- First add tenant_id column
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- Update existing contacts to get tenant_id from their customer
UPDATE customer_contacts cc
SET tenant_id = c.tenant_id
FROM customers c
WHERE cc.customer_id = c.id AND cc.tenant_id IS NULL;

-- Make customer_id nullable (drop NOT NULL constraint)
ALTER TABLE customer_contacts ALTER COLUMN customer_id DROP NOT NULL;

-- Make tenant_id NOT NULL after backfill (contacts must belong to a tenant)
-- Only if there are no null tenant_ids left
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM customer_contacts WHERE tenant_id IS NULL) THEN
    ALTER TABLE customer_contacts ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- Add index on tenant_id for faster queries
CREATE INDEX IF NOT EXISTS idx_customer_contacts_tenant_id ON customer_contacts(tenant_id);
