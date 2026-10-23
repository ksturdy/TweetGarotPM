-- Add URL field to agenda items and action items for document/schedule hyperlinks
ALTER TABLE meeting_agenda_items ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE meeting_action_items ADD COLUMN IF NOT EXISTS url TEXT;
