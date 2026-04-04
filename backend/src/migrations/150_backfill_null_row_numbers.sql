-- Backfill any phase_schedule_items with NULL row_number
-- This handles items created between when the column was added and the auto-assign code was deployed
WITH numbered AS (
  SELECT id,
    COALESCE(
      (SELECT MAX(row_number) FROM phase_schedule_items p2 WHERE p2.project_id = psi.project_id AND p2.row_number IS NOT NULL),
      0
    ) + ROW_NUMBER() OVER (PARTITION BY psi.project_id ORDER BY psi.sort_order, psi.id) as new_rn
  FROM phase_schedule_items psi
  WHERE psi.row_number IS NULL
)
UPDATE phase_schedule_items
SET row_number = numbered.new_rn
FROM numbered
WHERE phase_schedule_items.id = numbered.id;
