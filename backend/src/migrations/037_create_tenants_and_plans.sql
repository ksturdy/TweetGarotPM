-- Migration: Create Multi-Tenant Infrastructure
-- Description: Creates tenants table, subscription plans, and tenant settings

-- =====================================================
-- SUBSCRIPTION PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,           -- 'free', 'pro', 'enterprise'
  display_name VARCHAR(100) NOT NULL,         -- 'Free', 'Professional', 'Enterprise'
  description TEXT,
  price_monthly DECIMAL(10, 2) DEFAULT 0,
  price_yearly DECIMAL(10, 2) DEFAULT 0,

  -- Flexible limits stored as JSON
  limits JSONB DEFAULT '{
    "max_users": 3,
    "max_projects": 5,
    "max_customers": 50,
    "max_opportunities": 25,
    "storage_gb": 1
  }',

  -- Feature flags stored as JSON
  features JSONB DEFAULT '{
    "projects": true,
    "rfis": true,
    "submittals": true,
    "change_orders": true,
    "daily_reports": true,
    "schedule": true,
    "customers": true,
    "companies": true,
    "sales_pipeline": false,
    "campaigns": false,
    "estimates": false,
    "hr_module": false,
    "api_access": false,
    "custom_branding": false
  }',

  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default Free plan
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, limits, features, display_order)
VALUES (
  'free',
  'Free',
  'Perfect for small teams getting started',
  0,
  0,
  '{
    "max_users": 3,
    "max_projects": 5,
    "max_customers": 50,
    "max_opportunities": 25,
    "storage_gb": 1
  }',
  '{
    "projects": true,
    "rfis": true,
    "submittals": true,
    "change_orders": true,
    "daily_reports": true,
    "schedule": true,
    "customers": true,
    "companies": true,
    "sales_pipeline": false,
    "campaigns": false,
    "estimates": false,
    "hr_module": false,
    "api_access": false,
    "custom_branding": false
  }',
  1
) ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- TENANTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,

  -- Basic info
  name VARCHAR(255) NOT NULL,                 -- 'Tweet Garot Mechanical'
  slug VARCHAR(100) NOT NULL UNIQUE,          -- 'tweetgarot' (for URLs)

  -- Subscription
  plan_id INTEGER REFERENCES subscription_plans(id) DEFAULT 1,

  -- Settings and branding (flexible JSON)
  settings JSONB DEFAULT '{
    "branding": {
      "logo_url": null,
      "primary_color": "#1976d2",
      "company_name": null
    },
    "notifications": {
      "email_enabled": true,
      "daily_digest": false
    },
    "defaults": {
      "timezone": "America/Indiana/Indianapolis",
      "date_format": "MM/DD/YYYY"
    }
  }',

  -- Contact info
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  website VARCHAR(255),

  -- Status
  is_active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMP,

  -- Billing (for future Stripe integration)
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_plan ON tenants(plan_id);
CREATE INDEX idx_tenants_active ON tenants(is_active);
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active);

-- Update timestamp trigger for tenants
CREATE OR REPLACE FUNCTION update_tenants_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenants_timestamp();

-- Update timestamp trigger for subscription_plans
CREATE TRIGGER subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_tenants_timestamp();

-- =====================================================
-- USER INVITATIONS TABLE (for inviting users to tenant)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_invitations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  token VARCHAR(255) NOT NULL UNIQUE,
  invited_by INTEGER,  -- Will reference users after tenant_id is added
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_user_invitations_token ON user_invitations(token);
CREATE INDEX idx_user_invitations_tenant ON user_invitations(tenant_id);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);

COMMENT ON TABLE tenants IS 'Multi-tenant organizations using the platform';
COMMENT ON TABLE subscription_plans IS 'Available subscription tiers with limits and features';
COMMENT ON TABLE user_invitations IS 'Pending user invitations to join a tenant';
COMMENT ON COLUMN tenants.slug IS 'URL-safe identifier, used for subdomain if enabled later';
COMMENT ON COLUMN tenants.settings IS 'Flexible JSON settings for branding, notifications, defaults';
COMMENT ON COLUMN subscription_plans.limits IS 'JSON object with usage limits (max_users, max_projects, etc)';
COMMENT ON COLUMN subscription_plans.features IS 'JSON object with feature flags (modules enabled/disabled)';
