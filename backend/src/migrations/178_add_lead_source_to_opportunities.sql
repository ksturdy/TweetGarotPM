-- Migration 178: Link opportunities to their source lead emails
-- Adds foreign key to track which leads became opportunities

ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS lead_inbox_id INTEGER REFERENCES lead_inbox(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_lead_inbox ON opportunities(lead_inbox_id);

COMMENT ON COLUMN opportunities.lead_inbox_id IS 'Links opportunity to source lead email (if created from Lead Inbox)';
