-- Migration 072: Switch opportunities.assigned_to from users(id) to employees(id)
-- Currently assigned_to references users(id), but should reference employees(id)
-- so assignment pulls from the employee directory (active employees)

-- 1. Drop the old FK constraint on assigned_to (references users)
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_assigned_to_fkey;

-- 2. Backfill: convert assigned_to from user_id values to employee_id values
UPDATE opportunities o
SET assigned_to = e.id
FROM employees e
WHERE e.user_id = o.assigned_to AND o.assigned_to IS NOT NULL;

-- 3. Add new FK referencing employees
ALTER TABLE opportunities ADD CONSTRAINT opportunities_assigned_to_employee_fkey
  FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL;
