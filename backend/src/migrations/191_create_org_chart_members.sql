-- Migration 191: Create org_chart_members table
-- Self-referential hierarchy via reports_to, cascades on chart deletion

CREATE TABLE IF NOT EXISTS org_chart_members (
  id SERIAL PRIMARY KEY,
  org_chart_id INTEGER NOT NULL REFERENCES org_charts(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  title VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  reports_to INTEGER REFERENCES org_chart_members(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_chart_members_chart ON org_chart_members(org_chart_id);
CREATE INDEX idx_org_chart_members_reports ON org_chart_members(org_chart_id, reports_to);
