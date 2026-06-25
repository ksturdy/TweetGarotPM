-- Allow admins to require 2FA per user before enabling it globally
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_factor_required BOOLEAN DEFAULT FALSE;
