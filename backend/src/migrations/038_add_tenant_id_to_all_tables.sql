-- Migration: Add tenant_id to all tables
-- Description: Adds tenant isolation to all existing tables
-- IMPORTANT: Run 037_create_tenants_and_plans.sql first

-- =====================================================
-- STEP 1: Create default tenant (Tweet Garot)
-- =====================================================
INSERT INTO tenants (name, slug, email, plan_id, settings)
VALUES (
  'Tweet Garot Mechanical',
  'tweetgarot',
  'admin@tweetgarot.com',
  1,  -- Free plan (will have all features enabled as original tenant)
  '{
    "branding": {
      "logo_url": null,
      "primary_color": "#1976d2",
      "company_name": "Tweet Garot Mechanical"
    },
    "notifications": {
      "email_enabled": true,
      "daily_digest": false
    },
    "defaults": {
      "timezone": "America/Indiana/Indianapolis",
      "date_format": "MM/DD/YYYY"
    }
  }'
)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- STEP 2: Add tenant_id to PRIMARY tables (top-level entities)
-- =====================================================

-- Users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- Projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- Customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- Companies table (vendors, GCs, etc.)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- Opportunities table (sales pipeline)
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- Campaigns table
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- Estimates table
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- Estimate templates table
ALTER TABLE estimate_templates ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- HR: Departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- HR: Office locations
ALTER TABLE office_locations ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- HR: Employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- Pipeline stages (should be per-tenant for customization)
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- =====================================================
-- STEP 3: Backfill tenant_id = 1 for all existing data
-- =====================================================

-- Get the Tweet Garot tenant ID (should be 1)
DO $$
DECLARE
  default_tenant_id INTEGER;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'tweetgarot';

  IF default_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Default tenant not found. Please run 037_create_tenants_and_plans.sql first.';
  END IF;

  -- Update all primary tables
  UPDATE users SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE projects SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE customers SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE companies SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE opportunities SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE campaigns SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE estimates SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE estimate_templates SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE departments SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE office_locations SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE employees SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
  UPDATE pipeline_stages SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;

  RAISE NOTICE 'Successfully backfilled tenant_id = % for all existing data', default_tenant_id;
END $$;

-- =====================================================
-- STEP 4: Add NOT NULL constraints
-- =====================================================

-- Users - must belong to a tenant
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;

-- Projects - must belong to a tenant
ALTER TABLE projects ALTER COLUMN tenant_id SET NOT NULL;

-- Customers - must belong to a tenant
ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;

-- Companies - must belong to a tenant
ALTER TABLE companies ALTER COLUMN tenant_id SET NOT NULL;

-- Opportunities - must belong to a tenant
ALTER TABLE opportunities ALTER COLUMN tenant_id SET NOT NULL;

-- Campaigns - must belong to a tenant
ALTER TABLE campaigns ALTER COLUMN tenant_id SET NOT NULL;

-- Estimates - must belong to a tenant
ALTER TABLE estimates ALTER COLUMN tenant_id SET NOT NULL;

-- Estimate templates - must belong to a tenant
ALTER TABLE estimate_templates ALTER COLUMN tenant_id SET NOT NULL;

-- HR tables - must belong to a tenant
ALTER TABLE departments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE office_locations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE employees ALTER COLUMN tenant_id SET NOT NULL;

-- Pipeline stages - must belong to a tenant
ALTER TABLE pipeline_stages ALTER COLUMN tenant_id SET NOT NULL;

-- =====================================================
-- STEP 5: Create indexes for tenant_id columns
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant ON opportunities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_estimates_tenant ON estimates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_estimate_templates_tenant ON estimate_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_departments_tenant ON departments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_office_locations_tenant ON office_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_tenant ON pipeline_stages(tenant_id);

-- Composite indexes for common queries (tenant + other filters)
CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_stage ON opportunities(tenant_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_active ON customers(tenant_id, active_customer);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_status ON employees(tenant_id, employment_status);

-- =====================================================
-- STEP 6: Update unique constraints to be tenant-scoped
-- =====================================================

-- Project numbers should be unique within a tenant, not globally
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_tenant_number ON projects(tenant_id, number);

-- Employee email should be unique within a tenant
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_tenant_email ON employees(tenant_id, email);

-- Estimate numbers should be unique within a tenant
ALTER TABLE estimates DROP CONSTRAINT IF EXISTS estimates_estimate_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_estimates_tenant_number ON estimates(tenant_id, estimate_number);

-- Department names should be unique within a tenant
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_tenant_name ON departments(tenant_id, name);

-- Office location names should be unique within a tenant
ALTER TABLE office_locations DROP CONSTRAINT IF EXISTS office_locations_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_office_locations_tenant_name ON office_locations(tenant_id, name);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN users.tenant_id IS 'Tenant this user belongs to';
COMMENT ON COLUMN projects.tenant_id IS 'Tenant this project belongs to';
COMMENT ON COLUMN customers.tenant_id IS 'Tenant this customer belongs to';
COMMENT ON COLUMN companies.tenant_id IS 'Tenant this company belongs to';
COMMENT ON COLUMN opportunities.tenant_id IS 'Tenant this opportunity belongs to';
COMMENT ON COLUMN campaigns.tenant_id IS 'Tenant this campaign belongs to';
COMMENT ON COLUMN estimates.tenant_id IS 'Tenant this estimate belongs to';
COMMENT ON COLUMN departments.tenant_id IS 'Tenant this department belongs to';
COMMENT ON COLUMN office_locations.tenant_id IS 'Tenant this office location belongs to';
COMMENT ON COLUMN employees.tenant_id IS 'Tenant this employee belongs to';
COMMENT ON COLUMN pipeline_stages.tenant_id IS 'Tenant these pipeline stages belong to';
