-- Migration 197: Create trade_show_attendees table
-- Attendees can be internal (linked to a user) or external (free-form contact).
-- Cascades on parent deletion.

CREATE TABLE IF NOT EXISTS trade_show_attendees (
  id SERIAL PRIMARY KEY,
  trade_show_id INTEGER NOT NULL REFERENCES trade_shows(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),

  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  external_name VARCHAR(255),
  external_email VARCHAR(255),
  external_company VARCHAR(255),

  role VARCHAR(100),
  registration_status VARCHAR(50) DEFAULT 'pending'
    CHECK (registration_status IN ('pending', 'registered', 'confirmed', 'cancelled')),
  arrival_date DATE,
  departure_date DATE,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_attendee_identity CHECK (user_id IS NOT NULL OR external_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_tsa_show ON trade_show_attendees(trade_show_id);
CREATE INDEX IF NOT EXISTS idx_tsa_tenant ON trade_show_attendees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tsa_user ON trade_show_attendees(user_id);
