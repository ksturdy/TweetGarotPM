-- Merge "homework" into "note" - every projection_notes row is now type='note'
-- or type='gain_fade'. The optional assigned_to / due_date / status fields
-- determine whether a note is also a task; no separate type discriminator.

UPDATE projection_notes SET type = 'note' WHERE type = 'homework';

ALTER TABLE projection_notes
  DROP CONSTRAINT IF EXISTS projection_notes_type_check;

ALTER TABLE projection_notes
  ADD CONSTRAINT projection_notes_type_check
  CHECK (type IN ('note', 'gain_fade'));

-- The old "open homework" partial index referenced type='homework' which no
-- longer exists. Rebuild it for any note with an open status (i.e. any task).
DROP INDEX IF EXISTS idx_projection_notes_assigned_open;

CREATE INDEX IF NOT EXISTS idx_projection_notes_open_tasks
  ON projection_notes(assigned_to)
  WHERE type = 'note' AND status = 'open' AND assigned_to IS NOT NULL;
