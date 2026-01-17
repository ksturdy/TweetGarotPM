-- Update ball_in_court to reference companies instead of users
-- This makes more sense for RFIs as we're tracking which company currently has the ball

-- Drop the old constraint and index
ALTER TABLE rfis DROP CONSTRAINT IF EXISTS rfis_ball_in_court_fkey;
DROP INDEX IF EXISTS idx_rfis_ball_in_court;

-- Temporarily allow NULL values and clear existing data
UPDATE rfis SET ball_in_court = NULL WHERE ball_in_court IS NOT NULL;

-- Alter the column to reference companies instead
-- Note: We're keeping the same column name for backwards compatibility
ALTER TABLE rfis DROP COLUMN IF EXISTS ball_in_court;
ALTER TABLE rfis ADD COLUMN ball_in_court INTEGER REFERENCES companies(id);

-- Add index for ball_in_court lookups
CREATE INDEX IF NOT EXISTS idx_rfis_ball_in_court ON rfis(ball_in_court);
