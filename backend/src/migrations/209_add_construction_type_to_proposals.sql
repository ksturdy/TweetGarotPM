-- Migration 209: Add construction_type column to proposals
-- Tracks the type of construction (new, renovation, addition, etc.) for
-- template variable substitution like {{construction_type}}.

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS construction_type VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_proposals_construction_type ON proposals(construction_type);

COMMENT ON COLUMN proposals.construction_type IS 'Type of construction (e.g. New Construction, Renovation, Addition, Tenant Improvement)';
