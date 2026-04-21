-- Add prior_week_cost column to vp_phase_codes
-- This column is imported directly from the Vista 'Prior Week Cost' column
ALTER TABLE vp_phase_codes ADD COLUMN IF NOT EXISTS prior_week_cost NUMERIC(14,2) DEFAULT 0;
