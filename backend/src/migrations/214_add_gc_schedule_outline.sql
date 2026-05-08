-- Migration 214: outline (header / task) hierarchy on GC schedule activities
--
-- GC schedules are inherently hierarchical — WBS summary rows ("M -
-- Milestones", "500 - CONVERTING (Bldg 167)", "Structural Steel") group
-- the actual activities under them. Phase 1 stored everything flat.
-- This migration:
--   1. Adds outline_level (0 = task, 1 = summary header)
--   2. Adds parent_summary_order pointing to the display_order of the
--      nearest preceding summary row in the same version, so the frontend
--      can build a 2-level expand/collapse tree without needing a self-FK
--      and the bulk-insert pipeline doesn't need a 2-pass keyed insert.
--   3. Marks existing rows where activity_id IS NULL as summary rows,
--      strips the duplicated WBS-code\twbs-name pattern from their names
--      (P6 PDFs print "GP - Crossett Converting\tGP - Crossett Converting"
--      for these), and back-fills parent_summary_order on tasks.

ALTER TABLE gc_schedule_activities
  ADD COLUMN IF NOT EXISTS outline_level INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_summary_order INTEGER;

-- Mark existing summary rows
UPDATE gc_schedule_activities
SET is_summary = TRUE, outline_level = 1
WHERE activity_id IS NULL AND is_summary = FALSE;

-- Dedupe summary names: "X X" -> "X" when the first half equals the second.
-- Regex: capture the longest prefix that repeats with whitespace separator.
UPDATE gc_schedule_activities
SET activity_name = TRIM(BOTH FROM (regexp_match(activity_name, '^(.+?)\s+\1\s*$'))[1])
WHERE is_summary = TRUE
  AND activity_name ~ '^(.+?)\s+\1\s*$';

-- Backfill parent_summary_order for tasks: nearest preceding summary by
-- display_order within the same version.
UPDATE gc_schedule_activities a
SET parent_summary_order = (
  SELECT MAX(s.display_order)
  FROM gc_schedule_activities s
  WHERE s.version_id = a.version_id
    AND s.is_summary = TRUE
    AND s.display_order < a.display_order
)
WHERE a.is_summary = FALSE
  AND a.parent_summary_order IS NULL;

CREATE INDEX IF NOT EXISTS idx_gc_activities_summary
  ON gc_schedule_activities(version_id, parent_summary_order);
