-- Migration 201: Resume Templates module
-- Creates resume_templates table + adds template_id FK on employee_resumes
-- Seeds the existing "Classic Two-Column" layout as the default template.

CREATE TABLE IF NOT EXISTS resume_templates (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_key VARCHAR(64) NOT NULL,       -- maps to a renderer in resumePdfGenerator
  page_size VARCHAR(16) NOT NULL DEFAULT 'letter',
  orientation VARCHAR(16) NOT NULL DEFAULT 'portrait',
  max_pages INTEGER NOT NULL DEFAULT 1,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  preview_image_path VARCHAR(512),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resume_templates_tenant ON resume_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resume_templates_default ON resume_templates(tenant_id, is_default) WHERE is_default = TRUE;

ALTER TABLE employee_resumes
  ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES resume_templates(id) ON DELETE SET NULL;

-- Seed the existing layout as the "Classic Two-Column" default for every tenant.
INSERT INTO resume_templates (tenant_id, name, description, template_key, page_size, orientation, max_pages, is_default, is_active)
SELECT
  t.id,
  'Classic Two-Column',
  'Dark navy sidebar with photo and contact info, white main column with summary, projects, education, certifications, and skills. Constrained to a single 8.5x11 portrait page.',
  'classic_two_column',
  'letter',
  'portrait',
  1,
  TRUE,
  TRUE
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM resume_templates rt
  WHERE rt.tenant_id = t.id AND rt.template_key = 'classic_two_column'
);
