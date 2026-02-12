-- Migration 080: Create Proposals Module (Core Tables)
-- Creates proposals and proposal_sections tables with auto-incrementing proposal numbers

-- Function to generate proposal numbers (format: P-YYYY-0001)
CREATE OR REPLACE FUNCTION generate_proposal_number(p_tenant_id INTEGER)
RETURNS VARCHAR(20) AS $$
DECLARE
  v_current_year INTEGER;
  v_next_number INTEGER;
  v_proposal_number VARCHAR(20);
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE);

  -- Get the next number for this tenant and year
  SELECT COALESCE(MAX(
    CASE
      WHEN p.proposal_number ~ '^P-[0-9]{4}-[0-9]+$'
      THEN CAST(SUBSTRING(p.proposal_number FROM 'P-[0-9]{4}-([0-9]+)') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_number
  FROM proposals p
  WHERE p.tenant_id = p_tenant_id
    AND p.proposal_number LIKE 'P-' || v_current_year || '-%';

  -- Format as P-YYYY-0001
  v_proposal_number := 'P-' || v_current_year || '-' || LPAD(v_next_number::TEXT, 4, '0');

  RETURN v_proposal_number;
END;
$$ LANGUAGE plpgsql;

-- Main proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_number VARCHAR(20) NOT NULL,

  -- Relationships
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
  template_id INTEGER REFERENCES proposal_templates(id) ON DELETE SET NULL,

  -- Basic Information
  title VARCHAR(500) NOT NULL,
  project_name VARCHAR(255),
  project_location TEXT,

  -- Content Sections
  executive_summary TEXT,
  company_overview TEXT,
  scope_of_work TEXT,
  approach_and_methodology TEXT,

  -- Pricing
  total_amount DECIMAL(15, 2),
  payment_terms TEXT,
  terms_and_conditions TEXT,

  -- Workflow Status
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  -- Status values: draft, pending_review, approved, sent, accepted, rejected, expired
  sent_date TIMESTAMP,
  valid_until DATE,
  accepted_date TIMESTAMP,
  rejection_reason TEXT,

  -- Version Control
  parent_proposal_id INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  is_latest BOOLEAN NOT NULL DEFAULT true,

  -- Branding
  logo_file_name VARCHAR(255),
  logo_file_path VARCHAR(500),
  logo_file_size INTEGER,
  logo_file_type VARCHAR(100),

  -- Audit Fields
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  CONSTRAINT proposals_tenant_number_unique UNIQUE (tenant_id, proposal_number),
  CONSTRAINT proposals_status_check CHECK (status IN (
    'draft', 'pending_review', 'approved', 'sent', 'accepted', 'rejected', 'expired'
  ))
);

-- Proposal sections table
CREATE TABLE IF NOT EXISTS proposal_sections (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,

  section_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  display_order INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT proposal_sections_order_unique UNIQUE (proposal_id, display_order)
);

-- Indexes for proposals
CREATE INDEX IF NOT EXISTS idx_proposals_tenant ON proposals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proposals_customer ON proposals(customer_id);
CREATE INDEX IF NOT EXISTS idx_proposals_opportunity ON proposals(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_by ON proposals(created_by);
CREATE INDEX IF NOT EXISTS idx_proposals_number ON proposals(proposal_number);
CREATE INDEX IF NOT EXISTS idx_proposals_parent ON proposals(parent_proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposals_latest ON proposals(is_latest) WHERE is_latest = true;

-- Indexes for proposal_sections
CREATE INDEX IF NOT EXISTS idx_proposal_sections_proposal ON proposal_sections(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_sections_order ON proposal_sections(proposal_id, display_order);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proposal_sections_updated_at
  BEFORE UPDATE ON proposal_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE proposals IS 'Main proposals table with workflow status and version control';
COMMENT ON COLUMN proposals.proposal_number IS 'Auto-generated proposal number in format P-YYYY-0001';
COMMENT ON COLUMN proposals.status IS 'Workflow status: draft, pending_review, approved, sent, accepted, rejected, expired';
COMMENT ON COLUMN proposals.is_latest IS 'Flag to mark the latest version when revisions are created';
COMMENT ON FUNCTION generate_proposal_number IS 'Generates unique proposal numbers in format P-YYYY-0001';
