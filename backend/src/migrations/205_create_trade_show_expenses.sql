-- Migration 205: Create trade_show_expenses table
-- Tracks individual expense line items per trade show, grouped by category.
-- Coexists with the legacy registration_cost / booth_cost / travel_budget /
-- total_budget fields on trade_shows (those represent the *budget*; this
-- table represents the *actual* expenses booked against the show).

CREATE TABLE IF NOT EXISTS trade_show_expenses (
  id SERIAL PRIMARY KEY,
  trade_show_id INTEGER NOT NULL REFERENCES trade_shows(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),

  category VARCHAR(50) NOT NULL DEFAULT 'other'
    CHECK (category IN (
      'registration', 'booth', 'travel', 'lodging', 'meals',
      'shipping', 'marketing_materials', 'entertainment', 'staffing', 'other'
    )),
  description VARCHAR(500),
  vendor VARCHAR(255),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense_date DATE,
  notes TEXT,

  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tse_show ON trade_show_expenses(trade_show_id);
CREATE INDEX IF NOT EXISTS idx_tse_tenant ON trade_show_expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tse_category ON trade_show_expenses(trade_show_id, category);
