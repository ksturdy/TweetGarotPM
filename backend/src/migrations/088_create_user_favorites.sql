-- Create user_favorites table for per-user favorite tracking
CREATE TABLE IF NOT EXISTS user_favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- 'project', 'customer', 'estimate', etc.
  entity_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure a user can only favorite an entity once
  UNIQUE(user_id, entity_type, entity_id)
);

-- Create indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_entity ON user_favorites(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_lookup ON user_favorites(user_id, entity_type, entity_id);

-- Migrate existing favorites from projects table (if any exist)
-- Assuming we want to keep them as favorites for all users in the tenant
-- Note: This is a best-effort migration. Ideally, you'd want to know which user favorited each item.
INSERT INTO user_favorites (user_id, entity_type, entity_id)
SELECT DISTINCT
  u.id as user_id,
  'project' as entity_type,
  p.id as entity_id
FROM projects p
CROSS JOIN users u
WHERE p.favorite = true
  AND u.tenant_id = p.tenant_id
ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING;

-- Migrate existing favorites from customers table (if any exist)
INSERT INTO user_favorites (user_id, entity_type, entity_id)
SELECT DISTINCT
  u.id as user_id,
  'customer' as entity_type,
  c.id as entity_id
FROM customers c
CROSS JOIN users u
WHERE c.favorite = true
  AND u.tenant_id = c.tenant_id
ON CONFLICT (user_id, entity_type, entity_id) DO NOTHING;

-- Remove old favorite columns from projects and customers tables
ALTER TABLE projects DROP COLUMN IF EXISTS favorite;
ALTER TABLE customers DROP COLUMN IF EXISTS favorite;

-- Drop old indexes
DROP INDEX IF EXISTS idx_projects_favorite;
DROP INDEX IF EXISTS idx_customers_favorite;
