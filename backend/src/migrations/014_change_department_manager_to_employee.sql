-- Change department manager_id to reference employees instead of users
-- First, drop the existing foreign key constraint
ALTER TABLE departments
DROP CONSTRAINT IF EXISTS departments_manager_id_fkey;

-- Add new foreign key constraint referencing employees table
ALTER TABLE departments
ADD CONSTRAINT departments_manager_id_fkey
FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

-- Update comment to reflect that this now references employees
COMMENT ON COLUMN departments.manager_id IS 'References employees table - the employee who manages this department';
