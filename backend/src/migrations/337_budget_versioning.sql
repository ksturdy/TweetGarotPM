-- Add version tracking to budgets table
-- Each regeneration creates a new row; budget_group_id links versions together.
-- First version of a group: budget_group_id = id (set via UPDATE after INSERT).
-- No FK constraint so the self-referencing first version can be set post-insert.

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS budget_group_id INTEGER;

-- Backfill: all existing budgets are their own V1 group
UPDATE budgets SET budget_group_id = id WHERE budget_group_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_budget_group_id ON budgets(budget_group_id);
