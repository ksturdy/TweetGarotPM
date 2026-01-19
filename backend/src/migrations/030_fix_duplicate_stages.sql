-- Fix duplicate pipeline stages
-- Remove any duplicates and ensure we only have the 6 stages we need

-- Mark all stages inactive first
UPDATE pipeline_stages SET is_active = false;

-- Delete any duplicate or extra stages (keep only one of each expected stage by name)
DELETE FROM pipeline_stages p1
WHERE EXISTS (
  SELECT 1 FROM pipeline_stages p2
  WHERE p1.name = p2.name AND p1.id > p2.id
);

-- Delete any stages that aren't in our expected set
DELETE FROM pipeline_stages WHERE name NOT IN ('Lead', 'Opportunity Received', 'Quoted', 'Awarded', 'Lost', 'Passed');

-- Update existing stages to have correct values and mark as active
UPDATE pipeline_stages SET color = '#6B7280', probability = 'Low', display_order = 1, is_active = true WHERE name = 'Lead';
UPDATE pipeline_stages SET color = '#3B82F6', probability = 'Low', display_order = 2, is_active = true WHERE name = 'Opportunity Received';
UPDATE pipeline_stages SET color = '#8B5CF6', probability = 'Medium', display_order = 3, is_active = true WHERE name = 'Quoted';
UPDATE pipeline_stages SET color = '#10B981', probability = 'High', display_order = 4, is_active = true WHERE name = 'Awarded';
UPDATE pipeline_stages SET color = '#EF4444', probability = 'Low', display_order = 5, is_active = true WHERE name = 'Lost';
UPDATE pipeline_stages SET color = '#374151', probability = 'Low', display_order = 6, is_active = true WHERE name = 'Passed';

-- Insert any missing stages
INSERT INTO pipeline_stages (name, color, probability, display_order, is_active)
SELECT 'Lead', '#6B7280', 'Low', 1, true
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = 'Lead');

INSERT INTO pipeline_stages (name, color, probability, display_order, is_active)
SELECT 'Opportunity Received', '#3B82F6', 'Low', 2, true
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = 'Opportunity Received');

INSERT INTO pipeline_stages (name, color, probability, display_order, is_active)
SELECT 'Quoted', '#8B5CF6', 'Medium', 3, true
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = 'Quoted');

INSERT INTO pipeline_stages (name, color, probability, display_order, is_active)
SELECT 'Awarded', '#10B981', 'High', 4, true
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = 'Awarded');

INSERT INTO pipeline_stages (name, color, probability, display_order, is_active)
SELECT 'Lost', '#EF4444', 'Low', 5, true
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = 'Lost');

INSERT INTO pipeline_stages (name, color, probability, display_order, is_active)
SELECT 'Passed', '#374151', 'Low', 6, true
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = 'Passed');

-- Add comment for clarity
COMMENT ON TABLE pipeline_stages IS 'Sales pipeline stages: Lead, Opportunity Received, Quoted, Awarded, Lost, Passed';
