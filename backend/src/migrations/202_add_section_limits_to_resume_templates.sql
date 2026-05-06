-- Migration 202: add per-section item caps to resume templates.
-- Each template can specify how many items render per section so the PDF
-- stays inside its single 8.5x11 page.

ALTER TABLE resume_templates
  ADD COLUMN IF NOT EXISTS section_limits JSONB NOT NULL DEFAULT '{
    "summary_chars": 600,
    "projects": 5,
    "certifications": 6,
    "skills": 12,
    "languages": 4,
    "hobbies": 6,
    "references": 3
  }'::jsonb;

-- Backfill the seeded Classic Two-Column rows in case the default did not apply
UPDATE resume_templates
SET section_limits = '{
  "summary_chars": 600,
  "projects": 5,
  "certifications": 6,
  "skills": 12,
  "languages": 4,
  "hobbies": 6,
  "references": 3
}'::jsonb
WHERE template_key = 'classic_two_column' AND (section_limits IS NULL OR section_limits = '{}'::jsonb);
