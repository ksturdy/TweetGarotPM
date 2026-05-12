-- Migration 212 created phase_code_activity_links with schedule_item_id
-- referencing the deprecated `schedule_items` table. Real phase rows live in
-- `phase_schedule_items`. Repoint the FK before any links are inserted.
-- Safe to run unconditionally: the table is empty.

ALTER TABLE phase_code_activity_links
  DROP CONSTRAINT IF EXISTS phase_code_activity_links_schedule_item_id_fkey;

ALTER TABLE phase_code_activity_links
  ADD CONSTRAINT phase_code_activity_links_schedule_item_id_fkey
    FOREIGN KEY (schedule_item_id)
    REFERENCES phase_schedule_items(id)
    ON DELETE CASCADE;
