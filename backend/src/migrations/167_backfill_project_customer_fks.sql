-- Migration 167: Backfill project customer_id from client text field
--
-- CONTEXT: Most projects were imported from Vista with only the client text field populated,
-- but not the customer_id foreign key. This prevents customer detail pages from showing
-- their related projects. This migration links projects to customers by exact name match.
--
-- SCOPE: Updates ~6,424 projects where customer_id IS NULL and the client text exactly
-- matches an existing customer name (case-insensitive, trimmed).
--
-- SAFETY: The Vista import code uses COALESCE patterns that preserve existing FK values,
-- so this backfill will not be overwritten by future imports.

BEGIN;

-- First, show what we're about to update (dry-run reporting)
DO $$
DECLARE
  match_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT p.id) INTO match_count
  FROM projects p
  INNER JOIN customers c
    ON LOWER(TRIM(c.name)) = LOWER(TRIM(p.client))
    AND c.tenant_id = p.tenant_id
  WHERE p.customer_id IS NULL
    AND p.client IS NOT NULL
    AND p.client <> '';

  RAISE NOTICE 'Migration 167: Will update % projects with customer_id from exact client name match', match_count;
END $$;

-- Perform the backfill
-- Populate customer_id from client text where there's an exact name match
UPDATE projects p
SET customer_id = c.id
FROM customers c
WHERE p.customer_id IS NULL
  AND p.client IS NOT NULL
  AND p.client <> ''
  AND LOWER(TRIM(c.name)) = LOWER(TRIM(p.client))
  AND c.tenant_id = p.tenant_id;

-- Report results
DO $$
DECLARE
  total_linked INTEGER;
  still_unlinked INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_linked
  FROM projects
  WHERE customer_id IS NOT NULL;

  SELECT COUNT(*) INTO still_unlinked
  FROM projects
  WHERE customer_id IS NULL
    AND client IS NOT NULL
    AND client <> '';

  RAISE NOTICE 'Migration 167 complete:';
  RAISE NOTICE '  - Total projects with customer_id: %', total_linked;
  RAISE NOTICE '  - Projects with client text but no FK (needs manual linking): %', still_unlinked;
END $$;

COMMIT;
