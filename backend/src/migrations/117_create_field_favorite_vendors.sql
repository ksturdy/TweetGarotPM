-- Migration: Create field favorite vendors table
-- Simple vendor contacts for field foremen to reuse on POs and quote requests

CREATE TABLE IF NOT EXISTS field_favorite_vendors (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  phone VARCHAR(50),
  contact_name VARCHAR(255),
  email VARCHAR(255),

  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_field_fav_vendors_tenant ON field_favorite_vendors(tenant_id);

DROP TRIGGER IF EXISTS update_field_favorite_vendors_updated_at ON field_favorite_vendors;
CREATE TRIGGER update_field_favorite_vendors_updated_at
  BEFORE UPDATE ON field_favorite_vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
