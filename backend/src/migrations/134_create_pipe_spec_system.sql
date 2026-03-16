-- Migration: Create 3-tier pipe spec system (PipeSpec → PipingService → ProjectSystem)
-- Replaces flat piping_productivity_rates with structured rate tables
-- Supports: Butt Weld (BW), Grooved (GRV), Threaded (THD), Copper Solder (CU)

-- ═══════════════════════════════════════════════════════════
-- Tier 1: Pipe Specs (global, tenant-scoped)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pipe_specs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  joint_method VARCHAR(10) NOT NULL
    CHECK (joint_method IN ('BW', 'GRV', 'THD', 'CU')),
  material VARCHAR(50) NOT NULL,
  schedule VARCHAR(20) NOT NULL,
  stock_pipe_length DECIMAL(6,2) DEFAULT 21,
  joint_type VARCHAR(50) NOT NULL,
  pipe_material VARCHAR(50) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_pipe_specs_tenant ON pipe_specs(tenant_id);

DROP TRIGGER IF EXISTS update_pipe_specs_updated_at ON pipe_specs;
CREATE TRIGGER update_pipe_specs_updated_at
  BEFORE UPDATE ON pipe_specs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Pipe rates: hours per linear foot for each spec + size
CREATE TABLE IF NOT EXISTS pipe_spec_pipe_rates (
  id SERIAL PRIMARY KEY,
  pipe_spec_id INTEGER NOT NULL REFERENCES pipe_specs(id) ON DELETE CASCADE,
  pipe_size VARCHAR(20) NOT NULL,
  hours_per_foot DECIMAL(8,4) NOT NULL,
  UNIQUE(pipe_spec_id, pipe_size)
);

CREATE INDEX IF NOT EXISTS idx_pipe_spec_pipe_rates_spec ON pipe_spec_pipe_rates(pipe_spec_id);

-- Standard fitting rates: hours per each
CREATE TABLE IF NOT EXISTS pipe_spec_fitting_rates (
  id SERIAL PRIMARY KEY,
  pipe_spec_id INTEGER NOT NULL REFERENCES pipe_specs(id) ON DELETE CASCADE,
  fitting_type VARCHAR(50) NOT NULL,
  pipe_size VARCHAR(20) NOT NULL,
  hours_per_unit DECIMAL(8,4) NOT NULL,
  UNIQUE(pipe_spec_id, fitting_type, pipe_size)
);

CREATE INDEX IF NOT EXISTS idx_pipe_spec_fitting_rates_spec ON pipe_spec_fitting_rates(pipe_spec_id);
CREATE INDEX IF NOT EXISTS idx_pipe_spec_fitting_rates_lookup ON pipe_spec_fitting_rates(pipe_spec_id, fitting_type, pipe_size);

-- Reducing fitting rates: hours per each (main_size → reducing_size)
CREATE TABLE IF NOT EXISTS pipe_spec_reducing_rates (
  id SERIAL PRIMARY KEY,
  pipe_spec_id INTEGER NOT NULL REFERENCES pipe_specs(id) ON DELETE CASCADE,
  fitting_type VARCHAR(50) NOT NULL,
  main_size VARCHAR(20) NOT NULL,
  reducing_size VARCHAR(20) NOT NULL,
  hours_per_unit DECIMAL(8,4) NOT NULL,
  UNIQUE(pipe_spec_id, fitting_type, main_size, reducing_size)
);

CREATE INDEX IF NOT EXISTS idx_pipe_spec_reducing_rates_spec ON pipe_spec_reducing_rates(pipe_spec_id);

-- Reducing tee rates: main_size × branch_size → hours
CREATE TABLE IF NOT EXISTS pipe_spec_reducing_tee_rates (
  id SERIAL PRIMARY KEY,
  pipe_spec_id INTEGER NOT NULL REFERENCES pipe_specs(id) ON DELETE CASCADE,
  main_size VARCHAR(20) NOT NULL,
  branch_size VARCHAR(20) NOT NULL,
  hours_per_unit DECIMAL(8,4) NOT NULL,
  UNIQUE(pipe_spec_id, main_size, branch_size)
);

CREATE INDEX IF NOT EXISTS idx_pipe_spec_reducing_tee_rates_spec ON pipe_spec_reducing_tee_rates(pipe_spec_id);

-- Cross reducing rates: main_size × reducing_size → hours
CREATE TABLE IF NOT EXISTS pipe_spec_cross_reducing_rates (
  id SERIAL PRIMARY KEY,
  pipe_spec_id INTEGER NOT NULL REFERENCES pipe_specs(id) ON DELETE CASCADE,
  main_size VARCHAR(20) NOT NULL,
  reducing_size VARCHAR(20) NOT NULL,
  hours_per_unit DECIMAL(8,4) NOT NULL,
  UNIQUE(pipe_spec_id, main_size, reducing_size)
);

CREATE INDEX IF NOT EXISTS idx_pipe_spec_cross_reducing_rates_spec ON pipe_spec_cross_reducing_rates(pipe_spec_id);

-- ═══════════════════════════════════════════════════════════
-- Tier 2: Piping Services (global, tenant-scoped)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS piping_services (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  abbreviation VARCHAR(20) NOT NULL,
  color VARCHAR(20) DEFAULT '#3b82f6',
  service_category VARCHAR(50) NOT NULL,
  default_pipe_spec_id INTEGER REFERENCES pipe_specs(id),
  fitting_types JSONB DEFAULT '[]',
  valve_types JSONB DEFAULT '[]',
  accessories JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_piping_services_tenant ON piping_services(tenant_id);

DROP TRIGGER IF EXISTS update_piping_services_updated_at ON piping_services;
CREATE TRIGGER update_piping_services_updated_at
  BEFORE UPDATE ON piping_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Service size rules: pipes ≤ max_size_inches use the specified spec
CREATE TABLE IF NOT EXISTS service_size_rules (
  id SERIAL PRIMARY KEY,
  piping_service_id INTEGER NOT NULL REFERENCES piping_services(id) ON DELETE CASCADE,
  max_size_inches DECIMAL(6,2) NOT NULL,
  pipe_spec_id INTEGER NOT NULL REFERENCES pipe_specs(id),
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_service_size_rules_service ON service_size_rules(piping_service_id, max_size_inches);

-- ═══════════════════════════════════════════════════════════
-- Tier 3: Project Systems (per-takeoff, tenant-scoped)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS project_systems (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  takeoff_id INTEGER REFERENCES takeoffs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  abbreviation VARCHAR(20) NOT NULL,
  piping_service_id INTEGER REFERENCES piping_services(id),
  color VARCHAR(20) DEFAULT '#3b82f6',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_systems_takeoff ON project_systems(takeoff_id);
CREATE INDEX IF NOT EXISTS idx_project_systems_tenant ON project_systems(tenant_id);

DROP TRIGGER IF EXISTS update_project_systems_updated_at ON project_systems;
CREATE TRIGGER update_project_systems_updated_at
  BEFORE UPDATE ON project_systems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
