CREATE TABLE IF NOT EXISTS feedback_followers (
  id           SERIAL PRIMARY KEY,
  feedback_id  INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id    INTEGER NOT NULL,
  added_by     INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feedback_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_followers_feedback ON feedback_followers(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_followers_user    ON feedback_followers(user_id);
