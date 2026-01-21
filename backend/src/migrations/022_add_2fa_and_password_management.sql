-- Add 2FA and password management fields to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255),
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT[], -- Array of hashed backup codes
  ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Create audit log for password changes and 2FA events
CREATE TABLE IF NOT EXISTS security_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- 'password_changed', 'password_reset', '2fa_enabled', '2fa_disabled', '2fa_used', 'backup_code_used'
  performed_by INTEGER REFERENCES users(id), -- NULL if self-action, user_id of admin if admin action
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB, -- Additional context data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_action ON security_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at ON security_audit_log(created_at);

-- Set force_password_change to TRUE for all existing users (they're using default passwords)
UPDATE users SET force_password_change = TRUE WHERE force_password_change IS NULL OR force_password_change = FALSE;

-- Add comment to track migration
COMMENT ON TABLE password_reset_tokens IS 'Stores temporary tokens for password reset functionality';
COMMENT ON TABLE security_audit_log IS 'Audit trail for security-related actions';
