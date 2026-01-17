-- Add department_number column to departments table
ALTER TABLE departments
ADD COLUMN IF NOT EXISTS department_number VARCHAR(9) UNIQUE;

-- Add comment to explain format
COMMENT ON COLUMN departments.department_number IS 'Department number in format XXXX-XXXX (four digits, hyphen, four digits)';

-- Add check constraint to validate format (XXXX-XXXX)
ALTER TABLE departments
ADD CONSTRAINT department_number_format
CHECK (department_number IS NULL OR department_number ~ '^\d{4}-\d{4}$');
