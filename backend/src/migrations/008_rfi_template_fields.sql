-- Migration: Add comprehensive RFI template fields
-- Based on Tweet Garot Mechanical RFI Template

-- Add new fields to rfis table
ALTER TABLE rfis
-- Reference Information
ADD COLUMN IF NOT EXISTS spec_section VARCHAR(255),
ADD COLUMN IF NOT EXISTS drawing_sheet VARCHAR(255),
ADD COLUMN IF NOT EXISTS detail_grid_ref VARCHAR(255),
ADD COLUMN IF NOT EXISTS discipline VARCHAR(50) CHECK (discipline IN ('plumbing', 'hvac', 'piping', 'equipment', 'controls', 'other')),
ADD COLUMN IF NOT EXISTS discipline_other VARCHAR(100),

-- Suggested Solution
ADD COLUMN IF NOT EXISTS suggested_solution TEXT,

-- Impact Information
ADD COLUMN IF NOT EXISTS schedule_impact BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS schedule_impact_days INTEGER,
ADD COLUMN IF NOT EXISTS cost_impact BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cost_impact_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS affects_other_trades BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS affected_trades VARCHAR(255),

-- Attachments tracking (types)
ADD COLUMN IF NOT EXISTS has_sketches BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_photos BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_spec_pages BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_shop_drawings BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attachment_notes VARCHAR(255),

-- Response Classification
ADD COLUMN IF NOT EXISTS response_classification VARCHAR(50) CHECK (response_classification IN (
  'clarification_only',
  'submit_cor',
  'proceed_suggested',
  'see_attached',
  'refer_to'
)),
ADD COLUMN IF NOT EXISTS response_reference VARCHAR(255),

-- Response metadata
ADD COLUMN IF NOT EXISTS responded_by INTEGER REFERENCES users(id);

-- Add indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_rfis_discipline ON rfis(discipline);
CREATE INDEX IF NOT EXISTS idx_rfis_schedule_impact ON rfis(schedule_impact);
CREATE INDEX IF NOT EXISTS idx_rfis_cost_impact ON rfis(cost_impact);
CREATE INDEX IF NOT EXISTS idx_rfis_responded_by ON rfis(responded_by);
