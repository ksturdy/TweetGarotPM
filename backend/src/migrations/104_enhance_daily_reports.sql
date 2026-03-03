-- Migration: Enhance daily reports for field module
-- Adds status workflow, delay tracking, safety fields, and crew tracking

-- Add new columns to existing daily_reports table
ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved')),
  ADD COLUMN IF NOT EXISTS delay_hours DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delay_reason TEXT,
  ADD COLUMN IF NOT EXISTS safety_incidents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS safety_notes TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- Trade-specific crew tracking per daily report
CREATE TABLE IF NOT EXISTS daily_report_crews (
  id SERIAL PRIMARY KEY,
  daily_report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  trade VARCHAR(50) NOT NULL
    CHECK (trade IN ('plumbing', 'piping', 'sheet_metal', 'general', 'other')),
  foreman VARCHAR(255),
  crew_size INTEGER DEFAULT 0,
  hours_worked DECIMAL(5,2) DEFAULT 0,
  work_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dr_crews_report ON daily_report_crews(daily_report_id);
CREATE INDEX IF NOT EXISTS idx_dr_crews_trade ON daily_report_crews(trade);
