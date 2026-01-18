-- Add hr_access column to users table for granular HR permissions
-- Values: 'none' (no HR access), 'read' (view only), 'write' (full access)

-- Add column only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'hr_access'
  ) THEN
    ALTER TABLE users
    ADD COLUMN hr_access VARCHAR(20) DEFAULT 'none'
    CHECK (hr_access IN ('none', 'read', 'write'));
  END IF;
END $$;

-- Set default permissions based on current roles
-- Admins get full write access
UPDATE users SET hr_access = 'write' WHERE role = 'admin' AND (hr_access IS NULL OR hr_access = 'none');

-- Managers get read access by default (can be changed per user)
UPDATE users SET hr_access = 'read' WHERE role = 'manager' AND (hr_access IS NULL OR hr_access = 'none');

-- Regular users get no access by default
UPDATE users SET hr_access = 'none' WHERE role = 'user' AND hr_access IS NULL;
