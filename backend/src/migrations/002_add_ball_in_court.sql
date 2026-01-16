-- Add ball_in_court field to RFIs table
ALTER TABLE rfis ADD COLUMN IF NOT EXISTS ball_in_court INTEGER REFERENCES users(id);

-- Add index for ball_in_court lookups
CREATE INDEX IF NOT EXISTS idx_rfis_ball_in_court ON rfis(ball_in_court);
