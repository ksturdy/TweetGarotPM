-- Migration: Create field purchase orders tables
-- For field users to create purchase orders to vendors from the job site

CREATE TABLE IF NOT EXISTS field_purchase_orders (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,

  -- Vendor
  vendor_id INTEGER REFERENCES vendors(id),
  vendor_name VARCHAR(255),
  vendor_contact VARCHAR(255),
  vendor_phone VARCHAR(50),
  vendor_email VARCHAR(255),

  -- Order details
  description TEXT,
  delivery_date DATE,
  delivery_location TEXT,
  shipping_method VARCHAR(100),

  -- Financial
  subtotal DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,4) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  shipping_cost DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,

  -- Coding
  cost_code VARCHAR(50),
  phase_code VARCHAR(50),

  -- Status workflow
  status VARCHAR(50) DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'ordered', 'partially_received', 'received', 'closed', 'cancelled')),

  -- Approval
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,

  -- Metadata
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(project_id, number)
);

CREATE TABLE IF NOT EXISTS field_purchase_order_items (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES field_purchase_orders(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,

  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit VARCHAR(50),
  unit_cost DECIMAL(12,2) DEFAULT 0,
  total_cost DECIMAL(12,2) DEFAULT 0,

  -- Receiving
  quantity_received DECIMAL(10,2) DEFAULT 0,
  received_date DATE,
  received_by INTEGER REFERENCES users(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fpo_project ON field_purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_fpo_tenant ON field_purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fpo_vendor ON field_purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_fpo_status ON field_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_fpo_items_order ON field_purchase_order_items(purchase_order_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_field_purchase_orders_updated_at ON field_purchase_orders;
CREATE TRIGGER update_field_purchase_orders_updated_at
  BEFORE UPDATE ON field_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_field_purchase_order_items_updated_at ON field_purchase_order_items;
CREATE TRIGGER update_field_purchase_order_items_updated_at
  BEFORE UPDATE ON field_purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
