-- Track when each user last made an authenticated request, separate from
-- last_login_at (which is only written when credentials are submitted).
-- Powers the "Last Active" column in User Management and lets the auth
-- middleware enforce a sliding idle window.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_last_seen_at
  ON users (last_seen_at DESC NULLS LAST);
