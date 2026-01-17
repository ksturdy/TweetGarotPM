-- Update department_number format from XXXX-XXXX to XX-XX
-- First, drop the existing constraint
ALTER TABLE departments
DROP CONSTRAINT IF EXISTS department_number_format;

-- Modify the column length from VARCHAR(9) to VARCHAR(5)
ALTER TABLE departments
ALTER COLUMN department_number TYPE VARCHAR(5);

-- Update the comment to reflect the new format
COMMENT ON COLUMN departments.department_number IS 'Department number in format XX-XX (two digits, hyphen, two digits)';

-- Add new check constraint to validate format (XX-XX)
ALTER TABLE departments
ADD CONSTRAINT department_number_format
CHECK (department_number IS NULL OR department_number ~ '^\d{2}-\d{2}$');
