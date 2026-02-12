-- Migration 082: Create case study templates
-- Templates define which sections are visible and their order for case study previews/PDFs

CREATE TABLE IF NOT EXISTS case_study_templates (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    layout_config JSONB NOT NULL DEFAULT '{}',
    color_scheme VARCHAR(50) DEFAULT 'default',
    show_logo BOOLEAN DEFAULT true,
    show_images BOOLEAN DEFAULT true,
    show_metrics BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_case_study_templates_tenant ON case_study_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_case_study_templates_active ON case_study_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_case_study_templates_default ON case_study_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_case_study_templates_category ON case_study_templates(category);

-- Add template_id to case_studies
ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES case_study_templates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_case_studies_template ON case_studies(template_id);
