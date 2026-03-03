-- Migration: Create sheet metal fitting orders table
-- For field users to submit fabrication orders to the sheet metal shop

CREATE TABLE IF NOT EXISTS sm_fitting_orders (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,

  -- Order details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  required_by_date DATE,

  -- Drawing / spec references
  drawing_number VARCHAR(100),
  drawing_revision VARCHAR(50),
  spec_section VARCHAR(100),
  location_on_site TEXT,

  -- Sheet metal specific
  material_type VARCHAR(255),
  material_gauge VARCHAR(50),
  duct_type VARCHAR(100),
  dimensions VARCHAR(255),
  insulation_required BOOLEAN DEFAULT FALSE,
  insulation_spec TEXT,
  liner_required BOOLEAN DEFAULT FALSE,

  -- Quantities
  quantity DECIMAL(10,2) DEFAULT 1,
  unit VARCHAR(50),

  -- Status workflow
  status VARCHAR(50) DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'in_fabrication', 'ready', 'delivered', 'installed', 'cancelled')),

  -- Shop tracking
  shop_received_date DATE,
  shop_assigned_to VARCHAR(255),
  fabrication_start_date DATE,
  fabrication_complete_date DATE,
  delivery_date DATE,

  -- Coding
  cost_code VARCHAR(50),
  phase_code VARCHAR(50),

  -- Metadata
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(project_id, number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sm_fo_project ON sm_fitting_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_sm_fo_tenant ON sm_fitting_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sm_fo_status ON sm_fitting_orders(status);
CREATE INDEX IF NOT EXISTS idx_sm_fo_required_by ON sm_fitting_orders(required_by_date);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_sm_fitting_orders_updated_at ON sm_fitting_orders;
CREATE TRIGGER update_sm_fitting_orders_updated_at
  BEFORE UPDATE ON sm_fitting_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
