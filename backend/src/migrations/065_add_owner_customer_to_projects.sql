-- Add owner_customer_id to projects table
-- This allows tracking both the GC (customer_id) and the Owner (owner_customer_id)

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS owner_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_owner_customer ON projects(owner_customer_id);
