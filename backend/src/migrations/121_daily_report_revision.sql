-- Migration: Add revision status and tracking fields to daily reports

-- Drop existing status CHECK constraint and add new one with 'revision'
ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_status_check;
ALTER TABLE daily_reports ADD CONSTRAINT daily_reports_status_check
  CHECK (status IN ('draft', 'submitted', 'approved', 'revision'));

-- Add revision tracking columns
ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS revision_notes TEXT,
  ADD COLUMN IF NOT EXISTS revised_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS revised_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;
