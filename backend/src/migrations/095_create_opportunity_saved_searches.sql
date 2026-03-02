-- Create opportunity_saved_searches table for persisting AI search results
-- Stores full search criteria and results as JSONB so users can reload past searches

CREATE TABLE IF NOT EXISTS opportunity_saved_searches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  criteria JSONB NOT NULL,
  results JSONB NOT NULL,
  summary JSONB,
  lead_count INTEGER DEFAULT 0,
  total_estimated_value DECIMAL(15,2) DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opp_saved_searches_tenant ON opportunity_saved_searches(tenant_id);
CREATE INDEX idx_opp_saved_searches_created_by ON opportunity_saved_searches(created_by);
CREATE INDEX idx_opp_saved_searches_created_at ON opportunity_saved_searches(created_at DESC);
