-- Add user-adjustable fields for projected revenue overrides
-- These persist user changes to end dates and work contours per contract

ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS user_adjusted_end_months INTEGER;
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS user_selected_contour VARCHAR(20);
