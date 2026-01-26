-- Migration: Allow NULL tenant_id for platform admins
-- Platform admins are not associated with any specific tenant

-- Drop the NOT NULL constraint on users.tenant_id
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;

-- Add a check constraint: tenant_id can only be NULL if is_platform_admin is TRUE
-- Note: We allow tenant_id to be NULL for platform admins only
ALTER TABLE users ADD CONSTRAINT users_tenant_id_platform_admin_check
  CHECK (tenant_id IS NOT NULL OR is_platform_admin = TRUE);

COMMENT ON CONSTRAINT users_tenant_id_platform_admin_check ON users IS
  'Ensures tenant_id is only NULL for platform admin users';
