-- Migration: Create sheet metal fitting orders and items tables
-- Quick-add style sheet metal fitting orders (separate from duct fab orders)

CREATE TABLE IF NOT EXISTS sheet_metal_fitting_orders (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id INTEGER REFERENCES tenants(id),
  number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'normal',
  required_by_date DATE,
  drawing_number VARCHAR(100),
  drawing_revision VARCHAR(50),
  spec_section VARCHAR(100),
  location_on_site VARCHAR(255),
  material_type VARCHAR(100),
  quantity INTEGER DEFAULT 1,
  unit VARCHAR(20),
  status VARCHAR(50) DEFAULT 'draft',
  shop_received_date DATE,
  shop_assigned_to VARCHAR(255),
  fabrication_start_date DATE,
  fabrication_complete_date DATE,
  delivery_date DATE,
  cost_code VARCHAR(100),
  phase_code VARCHAR(100),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smfo_project ON sheet_metal_fitting_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_smfo_status ON sheet_metal_fitting_orders(status);
CREATE INDEX IF NOT EXISTS idx_smfo_tenant ON sheet_metal_fitting_orders(tenant_id);

CREATE TABLE IF NOT EXISTS sheet_metal_fitting_order_items (
  id SERIAL PRIMARY KEY,
  fitting_order_id INTEGER NOT NULL REFERENCES sheet_metal_fitting_orders(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 1,

  -- Fitting details
  fitting_type VARCHAR(50) NOT NULL,
  size VARCHAR(50),
  join_type VARCHAR(50),
  quantity INTEGER DEFAULT 1,

  -- Optional details
  remarks TEXT
);

CREATE INDEX IF NOT EXISTS idx_smfoi_order ON sheet_metal_fitting_order_items(fitting_order_id);
CREATE INDEX IF NOT EXISTS idx_smfoi_sort ON sheet_metal_fitting_order_items(fitting_order_id, sort_order);
