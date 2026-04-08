-- Add entered_in_vista flag to opportunities
-- When an opportunity is Awarded but not yet in Vista, it can appear in the labor forecast overlay
-- Once entered in Vista, this flag is set to true and the opportunity is excluded from the overlay

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS entered_in_vista BOOLEAN DEFAULT FALSE;
