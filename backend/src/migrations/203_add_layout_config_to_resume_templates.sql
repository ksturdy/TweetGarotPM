-- Migration 203: add layout_config to resume_templates so each template can
-- toggle which sections are rendered, control sidebar color, and decide
-- whether the photo/years-of-experience line are included.
-- section_limits still controls the *count* of items per section when visible.

ALTER TABLE resume_templates
  ADD COLUMN IF NOT EXISTS layout_config JSONB NOT NULL DEFAULT '{
    "show_photo": true,
    "show_years_experience": true,
    "sidebar_color": "#1e3a5f",
    "sections": {
      "contact": true,
      "references": true,
      "hobbies": true,
      "summary": true,
      "projects": true,
      "education": true,
      "skills": true,
      "languages": true
    }
  }'::jsonb;

-- Backfill any rows that landed with an empty config.
UPDATE resume_templates
SET layout_config = '{
  "show_photo": true,
  "show_years_experience": true,
  "sidebar_color": "#1e3a5f",
  "sections": {
    "contact": true,
    "references": true,
    "hobbies": true,
    "summary": true,
    "projects": true,
    "education": true,
    "skills": true,
    "languages": true
  }
}'::jsonb
WHERE layout_config IS NULL OR layout_config = '{}'::jsonb;
