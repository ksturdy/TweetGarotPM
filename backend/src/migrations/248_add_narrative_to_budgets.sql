-- Add a reference column so budgets can point to their uploaded design narrative
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS narrative_attachment_id INTEGER REFERENCES attachments(id) ON DELETE SET NULL;
