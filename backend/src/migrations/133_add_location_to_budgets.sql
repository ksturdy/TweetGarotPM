-- Add location field to budgets table
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS location VARCHAR(255);

-- Add location field to historical_projects table
ALTER TABLE historical_projects ADD COLUMN IF NOT EXISTS location VARCHAR(255);
