CREATE TABLE map_market_groups (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  pin_color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE map_market_group_markets (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES map_market_groups(id) ON DELETE CASCADE,
  market_value VARCHAR(255) NOT NULL,
  UNIQUE(group_id, market_value)
);

CREATE INDEX idx_map_market_groups_tenant ON map_market_groups(tenant_id);
CREATE INDEX idx_map_market_group_markets_group ON map_market_group_markets(group_id);
