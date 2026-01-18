-- Add hr_access column to users table for granular HR permissions
-- Values: 'none' (no HR access), 'read' (view only), 'write' (full access)

ALTER TABLE users
ADD COLUMN hr_access VARCHAR(20) DEFAULT 'none'
CHECK (hr_access IN ('none', 'read', 'write'));

-- Set default permissions based on current roles
-- Admins get full write access
UPDATE users SET hr_access = 'write' WHERE role = 'admin';

-- Managers get read access by default (can be changed per user)
UPDATE users SET hr_access = 'read' WHERE role = 'manager';

-- Regular users get no access by default
UPDATE users SET hr_access = 'none' WHERE role = 'user';
