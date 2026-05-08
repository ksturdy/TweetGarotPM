-- Migration 213: Backfill activity_name cleanup for previously-uploaded
-- GC schedule PDFs. Earlier parser versions left trailing P6 column
-- residue on some rows ("0 A", "0 *", " 0", etc.) which caused the diff
-- view to flag phantom name changes between two essentially-identical
-- uploads. This pass strips that residue in the database so existing
-- versions are aligned with the current parser output.
--
-- Idempotent: re-running is a no-op for rows already clean.

UPDATE gc_schedule_activities
SET activity_name = TRIM(REGEXP_REPLACE(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(activity_name, '(\s+(A|\*))+\s*$', '', 'g'),
      '\s+-?\d+(\.\d+)?\s*$', '', 'g'
    ),
    '(\s+(A|\*))+\s*$', '', 'g'
  ),
  '\s+', ' ', 'g'
))
WHERE activity_name ~ '\s+(A|\*|-?\d+(\.\d+)?)\s*$';

-- Run again to catch rows that had multiple trailing tokens (e.g. " 0 A").
-- Not strictly necessary with the regex above, but cheap and safe.
UPDATE gc_schedule_activities
SET activity_name = TRIM(REGEXP_REPLACE(
  REGEXP_REPLACE(
    REGEXP_REPLACE(activity_name, '\s+(A|\*)\s*$', '', 'g'),
    '\s+-?\d+(\.\d+)?\s*$', '', 'g'
  ),
  '\s+', ' ', 'g'
))
WHERE activity_name ~ '\s+(A|\*|-?\d+(\.\d+)?)\s*$';
