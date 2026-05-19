-- Migration 219: Create sell sheet templates (a.k.a. Service Offering templates)
-- Templates define which sections are visible and their order for sell sheet previews/PDFs.

CREATE TABLE IF NOT EXISTS sell_sheet_templates (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    layout_config JSONB NOT NULL DEFAULT '{}',
    color_scheme VARCHAR(50) DEFAULT 'default',
    show_logo BOOLEAN DEFAULT true,
    show_hero_image BOOLEAN DEFAULT true,
    show_images BOOLEAN DEFAULT true,
    show_footer BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sell_sheet_templates_tenant ON sell_sheet_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sell_sheet_templates_active ON sell_sheet_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_sell_sheet_templates_default ON sell_sheet_templates(is_default);
CREATE INDEX IF NOT EXISTS idx_sell_sheet_templates_category ON sell_sheet_templates(category);

-- Add template_id to sell_sheets
ALTER TABLE sell_sheets ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES sell_sheet_templates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sell_sheets_template ON sell_sheets(template_id);
