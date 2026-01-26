-- Add bid form file storage columns to estimates table
-- This allows estimates to be populated from an external Excel bid form

ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS bid_form_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS bid_form_filename VARCHAR(255),
ADD COLUMN IF NOT EXISTS bid_form_uploaded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS bid_form_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS build_method VARCHAR(20) DEFAULT 'manual'; -- 'manual' or 'excel_import'

-- Store extracted rate inputs from Excel as JSON for reference
ALTER TABLE estimates
ADD COLUMN IF NOT EXISTS rate_inputs JSONB;

-- Create index for finding estimates with bid forms
CREATE INDEX IF NOT EXISTS idx_estimates_bid_form ON estimates(bid_form_path) WHERE bid_form_path IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN estimates.bid_form_path IS 'R2/S3 storage path for the Excel bid form file';
COMMENT ON COLUMN estimates.bid_form_filename IS 'Original filename of the uploaded bid form';
COMMENT ON COLUMN estimates.bid_form_version IS 'Incremented each time the bid form is re-uploaded';
COMMENT ON COLUMN estimates.build_method IS 'How the estimate was built: manual (in-app) or excel_import';
COMMENT ON COLUMN estimates.rate_inputs IS 'JSON storage of labor rates extracted from Excel Rate Inputs tab';
