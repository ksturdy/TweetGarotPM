-- Migration 192: Create proposal_org_charts junction table
-- Links org charts to proposals, following the same pattern as proposal_case_studies etc.

CREATE TABLE IF NOT EXISTS proposal_org_charts (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  org_chart_id INTEGER NOT NULL REFERENCES org_charts(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proposal_id, org_chart_id)
);

CREATE INDEX idx_proposal_org_charts_proposal ON proposal_org_charts(proposal_id);
