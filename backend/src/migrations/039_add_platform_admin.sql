-- Migration: Add Platform Admin Support
-- This adds the ability to have platform-level administrators who can manage all tenants

-- Add is_platform_admin flag to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT FALSE;

-- Create index for quick platform admin lookups
CREATE INDEX IF NOT EXISTS idx_users_platform_admin ON users(is_platform_admin) WHERE is_platform_admin = TRUE;

-- Create platform_audit_log table for tracking platform-level actions
CREATE TABLE IF NOT EXISTS platform_audit_log (
    id SERIAL PRIMARY KEY,
    admin_user_id INTEGER NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50), -- 'tenant', 'user', 'plan', etc.
    target_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_admin ON platform_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_target ON platform_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit_log(created_at DESC);

-- Platform admin user will be created via seed script: npm run seed:platform-admin
-- This ensures proper password hashing via bcrypt

-- Add status column to tenants for suspension
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- Add billing columns to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly'; -- 'monthly' or 'yearly'
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP;

-- Create index for tenant status queries
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

COMMENT ON COLUMN users.is_platform_admin IS 'Platform-level admin who can manage all tenants';
COMMENT ON COLUMN tenants.status IS 'Tenant status: active, suspended, cancelled';
