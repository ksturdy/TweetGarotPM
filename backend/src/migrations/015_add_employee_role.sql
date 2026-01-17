-- Add role column to employees table for HR security
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user'));

-- Update comment to explain the role field
COMMENT ON COLUMN employees.role IS 'Employee role for HR module access control - admin can make changes, user is read-only';

-- Update existing employees to have 'user' role by default
UPDATE employees
SET role = 'user'
WHERE role IS NULL;
