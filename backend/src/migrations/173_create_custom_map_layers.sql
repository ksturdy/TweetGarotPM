-- Custom Map Layers: user-defined location overlays (service techs, offices, competitors, etc.)

CREATE TABLE IF NOT EXISTS custom_map_layers (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  pin_color VARCHAR(7) NOT NULL DEFAULT '#ef4444',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_map_layers_tenant ON custom_map_layers(tenant_id);

CREATE TABLE IF NOT EXISTS custom_map_pins (
  id SERIAL PRIMARY KEY,
  layer_id INTEGER NOT NULL REFERENCES custom_map_layers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  city VARCHAR(255),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  category VARCHAR(255),
  notes TEXT,
  geocode_source VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_custom_map_pins_layer ON custom_map_pins(layer_id);
CREATE INDEX idx_custom_map_pins_coords ON custom_map_pins(latitude, longitude) WHERE latitude IS NOT NULL;
