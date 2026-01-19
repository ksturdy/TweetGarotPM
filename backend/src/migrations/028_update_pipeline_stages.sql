-- Update pipeline stages to match new requirements
-- New stages: Lead, Opportunity Received, Quoted, Awarded, Lost, Passed
-- Note: This migration is compatible with both numeric and text-based probability values

-- Update existing stages (using text-based probability values for forward compatibility)
UPDATE pipeline_stages SET name = 'Lead', display_order = 1, color = '#6B7280' WHERE display_order = 1;
UPDATE pipeline_stages SET name = 'Opportunity Received', display_order = 2, color = '#3B82F6' WHERE display_order = 2;
UPDATE pipeline_stages SET name = 'Quoted', display_order = 3, color = '#8B5CF6' WHERE display_order = 3;
UPDATE pipeline_stages SET name = 'Awarded', display_order = 4, color = '#10B981' WHERE display_order = 4;
UPDATE pipeline_stages SET name = 'Lost', display_order = 5, color = '#EF4444' WHERE display_order = 5;
UPDATE pipeline_stages SET name = 'Passed', display_order = 6, color = '#374151' WHERE display_order = 6;

-- Mark Won and Negotiation as inactive since they're being replaced
UPDATE pipeline_stages SET is_active = false WHERE name IN ('Won', 'Negotiation');

-- Add comments for clarity
COMMENT ON TABLE pipeline_stages IS 'Sales pipeline stages: Lead, Opportunity Received, Quoted, Awarded, Lost, Passed';
