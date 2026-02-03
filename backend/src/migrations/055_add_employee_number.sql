-- Add employee_number field to employees table for Vista ERP linking
-- Vista uses 5-digit employee numbers (e.g., 21344, 15691)

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS employee_number VARCHAR(10);

-- Create index for efficient lookups during Vista auto-matching
CREATE INDEX IF NOT EXISTS idx_employees_employee_number
ON employees(tenant_id, employee_number);

-- Add comment to explain field purpose
COMMENT ON COLUMN employees.employee_number IS 'Vista ERP employee number for linking (typically 5-digit, e.g., 21344)';
