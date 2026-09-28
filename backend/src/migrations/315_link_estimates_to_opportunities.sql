ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimates_opportunity ON estimates(opportunity_id);
