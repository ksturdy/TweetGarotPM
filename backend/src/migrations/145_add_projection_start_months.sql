-- Add start month offset for labor forecast projections
-- Stores how many months from "now" a project's work begins (0 = current month)
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS user_adjusted_start_months INTEGER;
