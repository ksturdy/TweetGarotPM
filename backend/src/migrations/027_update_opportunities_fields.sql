-- Update opportunities table to add construction_type and market fields
-- Remove client_name requirement since we're removing customer information section

-- Add new columns
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS construction_type VARCHAR(100);
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS market VARCHAR(100);

-- Make client fields optional (remove NOT NULL constraint)
ALTER TABLE opportunities ALTER COLUMN client_name DROP NOT NULL;

-- Update existing project_type values to construction_type for data migration
UPDATE opportunities
SET construction_type = project_type
WHERE construction_type IS NULL AND project_type IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN opportunities.construction_type IS 'Type of construction: New Construction, Addition, or Renovation';
COMMENT ON COLUMN opportunities.market IS 'Market sector: Healthcare, Education, Commercial, Industrial, Retail, Government, Hospitality, Data Center';
COMMENT ON COLUMN opportunities.project_type IS 'Deprecated - use construction_type instead';
