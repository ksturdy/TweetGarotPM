-- Composite index for spec-filter-options queries that filter on
-- tenant_id, product, install_type, material with labor_time > 0
CREATE INDEX IF NOT EXISTS idx_est_products_spec_filters
  ON est_products(tenant_id, product, install_type, material)
  WHERE labor_time IS NOT NULL AND labor_time > 0;
