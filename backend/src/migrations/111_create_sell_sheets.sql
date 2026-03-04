-- Migration 111: Create sell sheets for service offering sell sheets
-- Sell sheets are rich-text PDF documents for each service line (HVAC, Plumbing, etc.)
-- They can be previewed, downloaded as PDFs, and attached to proposals

-- 1. sell_sheets table
CREATE TABLE IF NOT EXISTS sell_sheets (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  subtitle VARCHAR(255),
  layout_style VARCHAR(50) DEFAULT 'full_width',
  overview TEXT,
  content TEXT,
  sidebar_content TEXT,
  page2_content TEXT,
  footer_content TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  featured BOOLEAN DEFAULT false,
  display_order INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sell_sheets_tenant ON sell_sheets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sell_sheets_status ON sell_sheets(status);
CREATE INDEX IF NOT EXISTS idx_sell_sheets_service ON sell_sheets(service_name);

-- 2. sell_sheet_images table
CREATE TABLE IF NOT EXISTS sell_sheet_images (
  id SERIAL PRIMARY KEY,
  sell_sheet_id INTEGER NOT NULL REFERENCES sell_sheets(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(50),
  caption TEXT,
  display_order INTEGER NOT NULL,
  is_hero_image BOOLEAN DEFAULT false,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sell_sheet_images_sell_sheet ON sell_sheet_images(sell_sheet_id, display_order);

-- 3. proposal_sell_sheets junction table
CREATE TABLE IF NOT EXISTS proposal_sell_sheets (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  sell_sheet_id INTEGER NOT NULL REFERENCES sell_sheets(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(proposal_id, sell_sheet_id)
);

CREATE INDEX IF NOT EXISTS idx_proposal_sell_sheets_proposal ON proposal_sell_sheets(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_sell_sheets_sell_sheet ON proposal_sell_sheets(sell_sheet_id);
