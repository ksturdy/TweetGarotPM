-- Add change_from_last_projection column to vp_phase_codes
-- This column is imported directly from the Vista 'Change From Last Projection' column (column Q).
-- Previously the UI computed JTD - PreviousWeekCost and labeled it "Wk Change";
-- Vista actually exports a distinct value tied to the prior projection snapshot.
ALTER TABLE vp_phase_codes ADD COLUMN IF NOT EXISTS change_from_last_projection NUMERIC(14,2) DEFAULT 0;
