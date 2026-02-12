-- Add customer_logo_url to case_studies for client branding in previews/PDFs
ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS customer_logo_url TEXT;
