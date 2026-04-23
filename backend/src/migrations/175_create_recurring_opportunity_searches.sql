-- Create opportunity_recurring_searches table for scheduled/recurring searches
-- Separate from recent searches to distinguish one-time from recurring searches

CREATE TABLE IF NOT EXISTS opportunity_recurring_searches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_run_at TIMESTAMPTZ,
  last_result_count INTEGER DEFAULT 0,
  last_result_value DECIMAL(15,2) DEFAULT 0
);

CREATE INDEX idx_opp_recurring_searches_tenant ON opportunity_recurring_searches(tenant_id);
CREATE INDEX idx_opp_recurring_searches_active ON opportunity_recurring_searches(tenant_id, is_active);
CREATE INDEX idx_opp_recurring_searches_created_by ON opportunity_recurring_searches(created_by);

-- Add comment to clarify usage
COMMENT ON TABLE opportunity_recurring_searches IS 'Searches saved specifically for scheduled/recurring execution. Separate from one-time recent searches.';
