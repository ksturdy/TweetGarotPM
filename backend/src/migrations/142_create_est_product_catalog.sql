-- EST Map Prod Database: Product catalog with cost and labor data
-- Replaces pipe_specs system for estimating
-- Source: Monthly Excel upload (3 sheets: MapProd, Cost, Labor linked by product_id)

-- Extend vp_import_batches to allow 'est_products' file_type
ALTER TABLE vp_import_batches DROP CONSTRAINT IF EXISTS vp_import_batches_file_type_check;
ALTER TABLE vp_import_batches ADD CONSTRAINT vp_import_batches_file_type_check
  CHECK (file_type IN ('contracts', 'work_orders', 'employees', 'customers', 'vendors', 'phase_codes', 'est_products'));

-- Main product catalog table (denormalized from 3 Excel sheets)
CREATE TABLE IF NOT EXISTS est_products (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Shared key across all 3 sheets
  product_id VARCHAR(50) NOT NULL,

  -- MapProd sheet columns
  group_name VARCHAR(50),
  manufacturer VARCHAR(255),
  product VARCHAR(255),
  description TEXT,
  size VARCHAR(100),
  size_normalized VARCHAR(50),
  material VARCHAR(100),
  spec VARCHAR(100),
  install_type VARCHAR(100),
  source_description TEXT,
  range VARCHAR(100),
  finish VARCHAR(100),

  -- Cost sheet columns
  cost DECIMAL(12,4),
  cost_factor VARCHAR(100),
  cost_unit VARCHAR(20),
  cost_date DATE,
  cost_status VARCHAR(20),

  -- Labor sheet columns
  labor_time DECIMAL(10,4),
  labor_units VARCHAR(20),

  -- Computed unit type for easy filtering
  unit_type VARCHAR(10) GENERATED ALWAYS AS (
    CASE
      WHEN labor_units LIKE '%ft%' OR cost_unit LIKE '%ft%' THEN 'per_ft'
      ELSE 'each'
    END
  ) STORED,

  -- Import tracking
  import_batch_id INTEGER REFERENCES vp_import_batches(id) ON DELETE SET NULL,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tenant_id, product_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_est_products_tenant ON est_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_est_products_group ON est_products(tenant_id, group_name);
CREATE INDEX IF NOT EXISTS idx_est_products_material ON est_products(tenant_id, material);
CREATE INDEX IF NOT EXISTS idx_est_products_size ON est_products(tenant_id, size_normalized);
CREATE INDEX IF NOT EXISTS idx_est_products_install_type ON est_products(tenant_id, install_type);
CREATE INDEX IF NOT EXISTS idx_est_products_manufacturer ON est_products(tenant_id, manufacturer);
CREATE INDEX IF NOT EXISTS idx_est_products_product_id ON est_products(tenant_id, product_id);

-- Composite for common filter patterns
CREATE INDEX IF NOT EXISTS idx_est_products_group_material ON est_products(tenant_id, group_name, material);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_est_products_search ON est_products USING gin(
  to_tsvector('english',
    COALESCE(product_id, '') || ' ' ||
    COALESCE(product, '') || ' ' ||
    COALESCE(description, '') || ' ' ||
    COALESCE(manufacturer, '')
  )
);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_est_products_updated_at ON est_products;
CREATE TRIGGER update_est_products_updated_at
  BEFORE UPDATE ON est_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
