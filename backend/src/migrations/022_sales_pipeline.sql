-- Sales Pipeline Tables

-- Pipeline stages configuration
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  display_order INTEGER NOT NULL,
  color VARCHAR(7) NOT NULL, -- Hex color code
  probability INTEGER NOT NULL DEFAULT 0, -- Win probability %
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales opportunities/leads
CREATE TABLE IF NOT EXISTS opportunities (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  client_company VARCHAR(255),

  -- Opportunity details
  description TEXT,
  estimated_value DECIMAL(15, 2),
  estimated_start_date DATE,
  estimated_duration_days INTEGER,
  project_type VARCHAR(100), -- commercial, industrial, residential, etc.
  location VARCHAR(255),

  -- Pipeline tracking
  stage_id INTEGER REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  probability INTEGER DEFAULT 0, -- Override stage probability if needed
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent

  -- Assignment
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source VARCHAR(100), -- referral, website, cold call, trade show, etc.

  -- Conversion tracking
  converted_to_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  converted_at TIMESTAMP,
  lost_reason TEXT,

  -- Metadata
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log for opportunities (calls, meetings, emails, notes)
CREATE TABLE IF NOT EXISTS opportunity_activities (
  id SERIAL PRIMARY KEY,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,

  activity_type VARCHAR(50) NOT NULL, -- call, meeting, email, note, task, voice_note
  subject VARCHAR(255),
  notes TEXT,
  voice_note_url TEXT, -- For stored voice recordings
  voice_transcript TEXT, -- Transcribed text from voice

  -- Scheduling
  scheduled_at TIMESTAMP,
  completed_at TIMESTAMP,
  is_completed BOOLEAN DEFAULT false,

  -- Reminder
  reminder_at TIMESTAMP,
  reminder_sent BOOLEAN DEFAULT false,

  -- Metadata
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contacts associated with opportunities
CREATE TABLE IF NOT EXISTS opportunity_contacts (
  id SERIAL PRIMARY KEY,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  title VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom fields for opportunities (flexible metadata)
CREATE TABLE IF NOT EXISTS opportunity_custom_fields (
  id SERIAL PRIMARY KEY,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  field_value TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(opportunity_id, field_name)
);

-- Insert default pipeline stages
INSERT INTO pipeline_stages (name, display_order, color, probability) VALUES
  ('New Lead', 1, '#6B7280', 10),
  ('Contacted', 2, '#3B82F6', 20),
  ('Qualified', 3, '#8B5CF6', 40),
  ('Proposal Sent', 4, '#F59E0B', 60),
  ('Negotiation', 5, '#EF4444', 75),
  ('Won', 6, '#10B981', 100),
  ('Lost', 7, '#374151', 0)
ON CONFLICT DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_assigned ON opportunities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_last_activity ON opportunities(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_activities_opp ON opportunity_activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_activities_scheduled ON opportunity_activities(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_opportunity_contacts_opp ON opportunity_contacts(opportunity_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_pipeline_stages_updated_at ON pipeline_stages;
CREATE TRIGGER update_pipeline_stages_updated_at BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_opportunities_updated_at ON opportunities;
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_opportunity_activities_updated_at ON opportunity_activities;
CREATE TRIGGER update_opportunity_activities_updated_at BEFORE UPDATE ON opportunity_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_opportunity_contacts_updated_at ON opportunity_contacts;
CREATE TRIGGER update_opportunity_contacts_updated_at BEFORE UPDATE ON opportunity_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update last_activity_at when activity is added
CREATE OR REPLACE FUNCTION update_opportunity_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE opportunities
  SET last_activity_at = CURRENT_TIMESTAMP
  WHERE id = NEW.opportunity_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_last_activity ON opportunity_activities;
CREATE TRIGGER update_last_activity AFTER INSERT ON opportunity_activities
  FOR EACH ROW EXECUTE FUNCTION update_opportunity_last_activity();
