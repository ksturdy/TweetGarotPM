-- Migration 079: Create Proposal Templates Tables
-- Manages reusable proposal templates with sections

CREATE TABLE IF NOT EXISTS proposal_templates (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Template metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- e.g., 'Commercial', 'Healthcare', 'Industrial'

  -- Default content (can be overridden in individual sections)
  default_executive_summary TEXT,
  default_company_overview TEXT,
  default_terms_and_conditions TEXT,

  -- Status
  is_default BOOLEAN DEFAULT false, -- Mark one template as default
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proposal_template_sections (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES proposal_templates(id) ON DELETE CASCADE,

  -- Section metadata
  section_type VARCHAR(100) NOT NULL, -- 'executive_summary', 'scope', 'team', 'pricing', etc.
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL, -- Content with {{variable}} placeholders
  display_order INTEGER DEFAULT 0,

  -- Flags
  is_required BOOLEAN DEFAULT false, -- Must be included in proposals using this template

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proposal_templates_tenant ON proposal_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proposal_templates_active ON proposal_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_proposal_templates_default ON proposal_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_proposal_templates_category ON proposal_templates(category);

CREATE INDEX IF NOT EXISTS idx_proposal_template_sections_template ON proposal_template_sections(template_id);
CREATE INDEX IF NOT EXISTS idx_proposal_template_sections_order ON proposal_template_sections(template_id, display_order);

-- Comments
COMMENT ON TABLE proposal_templates IS 'Reusable proposal templates with variable placeholders';
COMMENT ON TABLE proposal_template_sections IS 'Sections within proposal templates';
COMMENT ON COLUMN proposal_template_sections.content IS 'Template content with {{variable}} placeholders like {{customer_name}}, {{project_name}}, etc.';
COMMENT ON COLUMN proposal_template_sections.section_type IS 'Type of section: executive_summary, company_overview, scope_of_work, approach, team, pricing, terms, etc.';
