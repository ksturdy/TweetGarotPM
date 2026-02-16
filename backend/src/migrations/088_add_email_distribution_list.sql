-- Add email distribution list field to projects for weekly goal reports
ALTER TABLE projects ADD COLUMN IF NOT EXISTS email_distribution_list TEXT;

-- Comment for documentation
COMMENT ON COLUMN projects.email_distribution_list IS 'Comma-separated email addresses for weekly goal reports';
