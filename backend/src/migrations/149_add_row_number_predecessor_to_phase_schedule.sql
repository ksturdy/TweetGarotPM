-- Add row_number (auto-populated ID) and predecessor_id to phase_schedule_items
ALTER TABLE phase_schedule_items
  ADD COLUMN IF NOT EXISTS row_number INTEGER,
  ADD COLUMN IF NOT EXISTS predecessor_id INTEGER;

-- Backfill row_number based on existing sort_order within each project
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY sort_order, id) AS rn
  FROM phase_schedule_items
)
UPDATE phase_schedule_items psi
SET row_number = numbered.rn
FROM numbered
WHERE psi.id = numbered.id;
