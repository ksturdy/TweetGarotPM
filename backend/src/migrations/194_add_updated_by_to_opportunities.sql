-- Migration 194: Track who last updated an opportunity
-- Recent Activity feed was showing the assigned_to user instead of the
-- actual editor because there was no field to record the latter.

ALTER TABLE opportunities
    ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_opportunities_updated_by ON opportunities(updated_by);
