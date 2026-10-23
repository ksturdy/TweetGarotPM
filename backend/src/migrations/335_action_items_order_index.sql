ALTER TABLE meeting_action_items
  ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

UPDATE meeting_action_items ai
SET order_index = sub.row_num
FROM (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY meeting_id ORDER BY created_at, id) - 1 AS row_num
  FROM meeting_action_items
) sub
WHERE ai.id = sub.id;
