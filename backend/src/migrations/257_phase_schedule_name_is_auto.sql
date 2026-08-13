-- Track whether a phase schedule item's name was auto-generated from Vista
-- vs. manually set by a user. Auto-generated names get re-synced on each
-- Vista upload; manually set names are left alone.
ALTER TABLE phase_schedule_items
  ADD COLUMN IF NOT EXISTS name_is_auto BOOLEAN NOT NULL DEFAULT TRUE;
