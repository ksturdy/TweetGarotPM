-- Password Security Hardening
-- Adds: account lockout, password history, unified policy support

-- Add lockout columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- Create password history table for reuse prevention
CREATE TABLE IF NOT EXISTS password_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON password_history(created_at);

-- Backfill current passwords into history so they count toward the 5-password reuse check
INSERT INTO password_history (user_id, password_hash, created_at)
SELECT id, password, COALESCE(password_changed_at, created_at)
FROM users
WHERE password IS NOT NULL;

-- Ensure all existing users have password_changed_at set (needed for aging checks)
UPDATE users
SET password_changed_at = COALESCE(password_changed_at, created_at)
WHERE password_changed_at IS NULL;

COMMENT ON TABLE password_history IS 'Stores hashed passwords to prevent reuse of the last N passwords';
COMMENT ON COLUMN users.failed_login_attempts IS 'Consecutive failed login attempts; resets on successful login';
COMMENT ON COLUMN users.locked_until IS 'Account locked until this timestamp after too many failed attempts';
