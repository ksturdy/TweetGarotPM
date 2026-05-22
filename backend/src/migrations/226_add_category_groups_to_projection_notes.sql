-- Add category (financial topic, single value) for notes
-- and groups_affected (team list, multi-value) for gain/fade items.

ALTER TABLE projection_notes
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS groups_affected TEXT[];

CREATE INDEX IF NOT EXISTS idx_projection_notes_category
  ON projection_notes(category)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projection_notes_groups_affected
  ON projection_notes USING GIN (groups_affected)
  WHERE groups_affected IS NOT NULL;
