-- Migration 208: Add market column to proposals
-- Tracks the primary market (sector) the proposal targets, using Vista/VP market values.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS market VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_proposals_market ON proposals(market);

COMMENT ON COLUMN proposals.market IS 'Primary market/sector for the proposal (Vista/VP market values)';
