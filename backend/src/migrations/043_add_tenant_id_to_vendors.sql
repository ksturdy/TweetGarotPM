-- Migration: Add tenant_id to vendors table
-- Description: Adds tenant isolation to vendors table (missed in migration 038)

-- Add tenant_id column
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- Backfill existing data with default tenant
UPDATE vendors SET tenant_id = 1 WHERE tenant_id IS NULL;

-- Create index for tenant queries
CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON vendors(tenant_id);
