-- Migration 247: Create marketing_media table for marketing-team uploaded assets

CREATE TABLE IF NOT EXISTS marketing_media (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  title VARCHAR(255),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  thumb_path VARCHAR(500),
  feed_path VARCHAR(500),
  file_size INTEGER,
  file_type VARCHAR(100),
  width INTEGER,
  height INTEGER,
  caption TEXT,
  tags TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketing_media_tenant_id ON marketing_media(tenant_id);
