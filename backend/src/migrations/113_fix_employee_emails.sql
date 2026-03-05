-- Migration 113: Update imported employee emails from vp format to firstname.lastname@tweetgarot.com
-- Converts emails like "vp12011_82@tweetgarot.imported" to "keith.agamaite@tweetgarot.com"
-- Handles duplicate names by appending employee_number for the 2nd+ occurrence

WITH numbered AS (
  SELECT
    id,
    LOWER(
      REGEXP_REPLACE(first_name, '[^a-zA-Z]', '', 'g') || '.' ||
      REGEXP_REPLACE(last_name, '[^a-zA-Z]', '', 'g')
    ) AS base_name,
    employee_number,
    ROW_NUMBER() OVER (
      PARTITION BY
        tenant_id,
        LOWER(REGEXP_REPLACE(first_name, '[^a-zA-Z]', '', 'g') || '.' || REGEXP_REPLACE(last_name, '[^a-zA-Z]', '', 'g'))
      ORDER BY id
    ) AS rn
  FROM employees
  WHERE email LIKE '%@tweetgarot.imported'
)
UPDATE employees e
SET email = CASE
  WHEN n.rn = 1 THEN n.base_name || '@tweetgarot.com'
  ELSE n.base_name || COALESCE(e.employee_number, e.id::text) || '@tweetgarot.com'
END,
updated_at = CURRENT_TIMESTAMP
FROM numbered n
WHERE e.id = n.id;
