-- Add last_results column to store full search results from the last run
ALTER TABLE opportunity_recurring_searches
ADD COLUMN IF NOT EXISTS last_results JSONB DEFAULT NULL;

COMMENT ON COLUMN opportunity_recurring_searches.last_results IS 'Full search results from the last run, stored as JSONB array';
