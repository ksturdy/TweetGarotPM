-- Add source column to distinguish field-submitted vs PM-created RFIs
ALTER TABLE rfis
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'pm';

-- Backfill existing RFIs as PM-created
UPDATE rfis SET source = 'pm' WHERE source IS NULL;

CREATE INDEX IF NOT EXISTS idx_rfis_source ON rfis(source);
