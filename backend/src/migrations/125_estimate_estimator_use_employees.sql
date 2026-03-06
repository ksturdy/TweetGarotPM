-- Migration 125: Switch estimates.estimator_id from users(id) to employees(id)
-- Currently estimator_id references users(id), but should reference employees(id)
-- so estimator pulls from the employee directory (active employees), matching opportunities pattern

-- 1. Drop the old FK constraint on estimator_id (references users)
ALTER TABLE estimates DROP CONSTRAINT IF EXISTS estimates_estimator_id_fkey;

-- 2. Backfill: convert estimator_id from user_id values to employee_id values
UPDATE estimates e
SET estimator_id = emp.id
FROM employees emp
WHERE emp.user_id = e.estimator_id AND e.estimator_id IS NOT NULL;

-- 3. Add new FK referencing employees
ALTER TABLE estimates ADD CONSTRAINT estimates_estimator_id_employee_fkey
  FOREIGN KEY (estimator_id) REFERENCES employees(id) ON DELETE SET NULL;
