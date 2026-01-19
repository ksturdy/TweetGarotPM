-- Rename "Opportunity Received" stage to "Opportunity"

UPDATE pipeline_stages
SET name = 'Opportunity'
WHERE name = 'Opportunity Received';

-- Update comment
COMMENT ON TABLE pipeline_stages IS 'Sales pipeline stages: Lead, Opportunity, Quoted, Awarded, Lost, Passed';
