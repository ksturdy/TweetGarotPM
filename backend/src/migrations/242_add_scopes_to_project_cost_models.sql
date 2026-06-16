ALTER TABLE project_cost_models ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT '{}';
