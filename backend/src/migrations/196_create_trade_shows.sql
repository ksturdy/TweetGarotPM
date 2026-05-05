-- Migration 196: Create trade_shows table for tracking trade show events
-- Used in the Marketing module to track upcoming trade shows, registrations,
-- assigned roles (sales lead, coordinator), and budgets.

CREATE TABLE IF NOT EXISTS trade_shows (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),

  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'registered', 'in_progress', 'completed', 'cancelled')),

  venue VARCHAR(255),
  city VARCHAR(120),
  state VARCHAR(50),
  country VARCHAR(80),
  address TEXT,

  event_start_date DATE,
  event_end_date DATE,
  event_start_time TIME,
  event_end_time TIME,
  registration_deadline DATE,

  registration_cost NUMERIC(12,2),
  booth_cost NUMERIC(12,2),
  travel_budget NUMERIC(12,2),
  total_budget NUMERIC(12,2),

  booth_number VARCHAR(50),
  booth_size VARCHAR(50),
  website_url TEXT,
  notes TEXT,

  sales_lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  coordinator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_shows_tenant ON trade_shows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trade_shows_status ON trade_shows(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_trade_shows_event_date ON trade_shows(tenant_id, event_start_date);
CREATE INDEX IF NOT EXISTS idx_trade_shows_sales_lead ON trade_shows(sales_lead_id);
CREATE INDEX IF NOT EXISTS idx_trade_shows_coordinator ON trade_shows(coordinator_id);
