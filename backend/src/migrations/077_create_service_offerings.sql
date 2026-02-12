-- Migration 077: Service Offerings Module
-- Creates service_offerings table for reusable service catalog

CREATE TABLE IF NOT EXISTS service_offerings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Core information
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- HVAC, Plumbing, Sheet Metal, Controls, etc.

  -- Optional pricing information
  pricing_model VARCHAR(50), -- fixed, hourly, per_unit, etc.
  typical_duration_days INTEGER,

  -- Display settings
  icon_name VARCHAR(50),
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_service_offerings_tenant ON service_offerings(tenant_id);
CREATE INDEX idx_service_offerings_category ON service_offerings(category);
CREATE INDEX idx_service_offerings_active ON service_offerings(is_active);
CREATE INDEX idx_service_offerings_display_order ON service_offerings(display_order);

-- Comments
COMMENT ON TABLE service_offerings IS 'Catalog of company services for use in proposals and projects';
COMMENT ON COLUMN service_offerings.category IS 'Service category: HVAC, Plumbing, Sheet Metal, Controls, etc.';
COMMENT ON COLUMN service_offerings.pricing_model IS 'Pricing approach: fixed, hourly, per_unit, custom';
COMMENT ON COLUMN service_offerings.display_order IS 'Order for display in lists and selectors';
