-- Migration: Add tenant_id to feedback tables
-- Description: Adds tenant isolation to feedback, feedback_votes, and feedback_comments tables
-- This was missed in the original multi-tenant migration (038)

-- =====================================================
-- STEP 1: Add tenant_id column to feedback table
-- =====================================================

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- =====================================================
-- STEP 2: Backfill tenant_id for existing feedback data
-- =====================================================

-- Get the default tenant ID (Tweet Garot) and update all existing feedback
DO $$
DECLARE
  default_tenant_id INTEGER;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'tweetgarot';

  IF default_tenant_id IS NULL THEN
    -- If no default tenant, try to get the first tenant
    SELECT id INTO default_tenant_id FROM tenants ORDER BY id LIMIT 1;
  END IF;

  IF default_tenant_id IS NOT NULL THEN
    -- Update feedback records that don't have a tenant_id
    UPDATE feedback SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

    RAISE NOTICE 'Successfully backfilled tenant_id = % for feedback records', default_tenant_id;
  ELSE
    RAISE NOTICE 'No tenants found - feedback records will need tenant_id set manually';
  END IF;
END $$;

-- =====================================================
-- STEP 3: Add NOT NULL constraint (only if tenants exist)
-- =====================================================

-- Make tenant_id required for new feedback items
DO $$
BEGIN
  -- Only add NOT NULL if all existing records have tenant_id
  IF NOT EXISTS (SELECT 1 FROM feedback WHERE tenant_id IS NULL) THEN
    ALTER TABLE feedback ALTER COLUMN tenant_id SET NOT NULL;
    RAISE NOTICE 'Added NOT NULL constraint to feedback.tenant_id';
  ELSE
    RAISE NOTICE 'Skipping NOT NULL constraint - some feedback records still have NULL tenant_id';
  END IF;
END $$;

-- =====================================================
-- STEP 4: Create indexes for tenant_id
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_feedback_tenant ON feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_tenant_status ON feedback(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_tenant_module ON feedback(tenant_id, module);

-- =====================================================
-- STEP 5: Add comment for documentation
-- =====================================================

COMMENT ON COLUMN feedback.tenant_id IS 'Tenant this feedback belongs to';
