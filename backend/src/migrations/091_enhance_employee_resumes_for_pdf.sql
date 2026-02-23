-- Migration 079: Enhance Employee Resumes for PDF Generation
-- Adds fields needed for professional PDF resume generation

-- Add new columns for enhanced resume features
ALTER TABLE employee_resumes
  ADD COLUMN IF NOT EXISTS employee_photo_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hobbies TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "references" JSONB DEFAULT '[]'::jsonb;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_employee_resumes_photo ON employee_resumes(employee_photo_path);

-- Add comments
COMMENT ON COLUMN employee_resumes.employee_photo_path IS 'Path to employee photo file for resume display';
COMMENT ON COLUMN employee_resumes.phone IS 'Employee phone number for contact section';
COMMENT ON COLUMN employee_resumes.email IS 'Employee email for contact section';
COMMENT ON COLUMN employee_resumes.address IS 'Employee address for contact section';
COMMENT ON COLUMN employee_resumes.languages IS 'JSON array of language objects: [{"language": "English", "proficiency": "Native"}, {"language": "Spanish", "proficiency": "Fluent"}]';
COMMENT ON COLUMN employee_resumes.hobbies IS 'Array of hobbies/interests for personal section';
COMMENT ON COLUMN employee_resumes."references" IS 'JSON array of professional references: [{"name": "John Doe", "title": "VP Operations", "company": "ABC Corp", "phone": "555-1234"}]';
