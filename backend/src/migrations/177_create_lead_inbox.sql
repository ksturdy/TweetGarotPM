-- Migration 177: Create Lead Inbox System
-- Email-to-lead tracking with AI extraction

-- Main table for incoming lead emails
CREATE TABLE IF NOT EXISTS lead_inbox (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Email metadata
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(255),
  subject VARCHAR(500),
  received_at TIMESTAMP NOT NULL,

  -- Email content
  body_text TEXT,
  body_html TEXT,
  stripped_text TEXT, -- Clean text without signatures/replies

  -- AI-extracted data (structured opportunity fields)
  extracted_data JSONB,
  ai_confidence VARCHAR(20), -- high, medium, low, manual
  ai_extraction_error TEXT,

  -- Processing status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Values: pending, ai_processed, approved, rejected, error
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,

  -- Opportunity linkage (when approved and converted)
  opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attachments for lead emails (PDFs, images, etc.)
CREATE TABLE IF NOT EXISTS lead_inbox_attachments (
  id SERIAL PRIMARY KEY,
  lead_inbox_id INTEGER NOT NULL REFERENCES lead_inbox(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes INTEGER,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log for lead processing (audit trail)
CREATE TABLE IF NOT EXISTS lead_inbox_activities (
  id SERIAL PRIMARY KEY,
  lead_inbox_id INTEGER NOT NULL REFERENCES lead_inbox(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  -- Values: received, ai_extracted, approved, rejected, error, manual_edit
  description TEXT,
  user_id INTEGER REFERENCES users(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_lead_inbox_tenant ON lead_inbox(tenant_id);
CREATE INDEX idx_lead_inbox_status ON lead_inbox(status);
CREATE INDEX idx_lead_inbox_received ON lead_inbox(received_at DESC);
CREATE INDEX idx_lead_inbox_from ON lead_inbox(from_email);
CREATE INDEX idx_lead_inbox_opportunity ON lead_inbox(opportunity_id);

CREATE INDEX idx_lead_inbox_attachments_lead ON lead_inbox_attachments(lead_inbox_id);
CREATE INDEX idx_lead_inbox_activities_lead ON lead_inbox_activities(lead_inbox_id);
CREATE INDEX idx_lead_inbox_activities_type ON lead_inbox_activities(activity_type);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_lead_inbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_lead_inbox_updated_at ON lead_inbox;
CREATE TRIGGER trigger_update_lead_inbox_updated_at
  BEFORE UPDATE ON lead_inbox
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_inbox_updated_at();

-- Comments for documentation
COMMENT ON TABLE lead_inbox IS 'Incoming lead emails forwarded to Titan PM for AI extraction and review';
COMMENT ON COLUMN lead_inbox.extracted_data IS 'JSONB object containing AI-extracted opportunity fields';
COMMENT ON COLUMN lead_inbox.status IS 'Processing status: pending → ai_processed → approved/rejected/error';
COMMENT ON COLUMN lead_inbox.ai_confidence IS 'AI confidence level: high, medium, low, or manual (user-entered)';
