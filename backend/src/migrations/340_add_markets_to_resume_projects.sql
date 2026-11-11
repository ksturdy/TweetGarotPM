-- Add markets field to resume_projects for displaying market segments on resumes
ALTER TABLE resume_projects ADD COLUMN IF NOT EXISTS markets TEXT;
