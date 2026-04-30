-- Migration 189: Add multi-page drawing set support
-- Adds page_count/is_drawing_set to drawings, creates drawing_pages table for per-page metadata

ALTER TABLE drawings
  ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_drawing_set BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS drawing_pages (
  id SERIAL PRIMARY KEY,
  drawing_id INTEGER NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  discipline VARCHAR(100),
  confidence DECIMAL(3,2),
  drawing_number VARCHAR(100),
  title VARCHAR(255),
  ai_classified BOOLEAN DEFAULT false,
  classified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(drawing_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_drawing_pages_drawing ON drawing_pages(drawing_id);
CREATE INDEX IF NOT EXISTS idx_drawing_pages_discipline ON drawing_pages(discipline);
