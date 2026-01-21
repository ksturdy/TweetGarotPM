-- Migration: Create Campaigns Module
-- Description: Sales campaign tracking system with isolated company/contact data

-- Main campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  owner_id INTEGER REFERENCES users(id),
  total_targets INTEGER DEFAULT 0,
  contacted_count INTEGER DEFAULT 0,
  opportunities_count INTEGER DEFAULT 0,
  total_opportunity_value DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaign weeks (for structured campaigns like the 6-week Phoenix campaign)
CREATE TABLE IF NOT EXISTS campaign_weeks (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  label VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, week_number)
);

-- Campaign companies (separate from main companies database)
CREATE TABLE IF NOT EXISTS campaign_companies (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sector VARCHAR(100),
  address TEXT,
  phone VARCHAR(50),
  website VARCHAR(255),
  tier VARCHAR(10) DEFAULT 'B' CHECK (tier IN ('A', 'B', 'C')),
  score INTEGER DEFAULT 70 CHECK (score >= 0 AND score <= 100),
  assigned_to_id INTEGER REFERENCES users(id),
  target_week INTEGER,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'prospect' CHECK (status IN (
    'prospect',
    'no_interest',
    'follow_up',
    'new_opp',
    'dead'
  )),

  -- Action tracking
  next_action VARCHAR(50) DEFAULT 'none' CHECK (next_action IN (
    'none',
    'follow_30',
    'opp_incoming',
    'no_follow'
  )),

  -- Company database integration
  linked_company_id INTEGER REFERENCES companies(id),
  is_added_to_database BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaign contacts (separate from main contacts)
CREATE TABLE IF NOT EXISTS campaign_contacts (
  id SERIAL PRIMARY KEY,
  campaign_company_id INTEGER REFERENCES campaign_companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaign opportunities
CREATE TABLE IF NOT EXISTS campaign_opportunities (
  id SERIAL PRIMARY KEY,
  campaign_company_id INTEGER REFERENCES campaign_companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  value DECIMAL(12,2) DEFAULT 0,
  stage VARCHAR(50) DEFAULT 'qualification' CHECK (stage IN (
    'qualification',
    'discovery',
    'proposal',
    'negotiation',
    'closed_won',
    'closed_lost'
  )),
  probability INTEGER DEFAULT 25 CHECK (probability >= 0 AND probability <= 100),
  close_date DATE,

  -- Link to main opportunities if converted
  linked_opportunity_id INTEGER REFERENCES opportunities(id),
  is_converted BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaign estimates/proposals
CREATE TABLE IF NOT EXISTS campaign_estimates (
  id SERIAL PRIMARY KEY,
  campaign_company_id INTEGER REFERENCES campaign_companies(id) ON DELETE CASCADE,
  campaign_opportunity_id INTEGER REFERENCES campaign_opportunities(id) ON DELETE SET NULL,
  estimate_number VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
    'draft',
    'pending',
    'sent',
    'accepted',
    'declined'
  )),
  sent_date DATE,
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaign activity log
CREATE TABLE IF NOT EXISTS campaign_activity_logs (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_company_id INTEGER REFERENCES campaign_companies(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
    'status_change',
    'action_change',
    'note',
    'contact_attempt',
    'meeting',
    'email',
    'phone_call',
    'opportunity_created',
    'estimate_sent',
    'company_added_to_db'
  )),
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team assignments for campaigns
CREATE TABLE IF NOT EXISTS campaign_team_members (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'member', 'viewer')),
  target_count INTEGER DEFAULT 0,
  contacted_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_campaign_companies_campaign ON campaign_companies(campaign_id);
CREATE INDEX idx_campaign_companies_assigned ON campaign_companies(assigned_to_id);
CREATE INDEX idx_campaign_companies_status ON campaign_companies(status);
CREATE INDEX idx_campaign_contacts_company ON campaign_contacts(campaign_company_id);
CREATE INDEX idx_campaign_opportunities_company ON campaign_opportunities(campaign_company_id);
CREATE INDEX idx_campaign_estimates_company ON campaign_estimates(campaign_company_id);
CREATE INDEX idx_campaign_activity_campaign ON campaign_activity_logs(campaign_id);
CREATE INDEX idx_campaign_activity_company ON campaign_activity_logs(campaign_company_id);
CREATE INDEX idx_campaign_weeks_campaign ON campaign_weeks(campaign_id);

-- Update trigger for campaigns.updated_at
CREATE OR REPLACE FUNCTION update_campaigns_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_timestamp();

-- Update trigger for campaign_companies.updated_at
CREATE TRIGGER campaign_companies_updated_at
  BEFORE UPDATE ON campaign_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_timestamp();

-- Update trigger for campaign_contacts.updated_at
CREATE TRIGGER campaign_contacts_updated_at
  BEFORE UPDATE ON campaign_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_timestamp();

-- Update trigger for campaign_opportunities.updated_at
CREATE TRIGGER campaign_opportunities_updated_at
  BEFORE UPDATE ON campaign_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_timestamp();

-- Update trigger for campaign_estimates.updated_at
CREATE TRIGGER campaign_estimates_updated_at
  BEFORE UPDATE ON campaign_estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_timestamp();

COMMENT ON TABLE campaigns IS 'Sales campaigns with isolated company tracking and optional database integration';
COMMENT ON TABLE campaign_companies IS 'Companies within a campaign - separate from main company database until manually added';
COMMENT ON COLUMN campaign_companies.linked_company_id IS 'Reference to companies table if added to main database';
COMMENT ON COLUMN campaign_companies.is_added_to_database IS 'Flag indicating if company has been added to main database';
