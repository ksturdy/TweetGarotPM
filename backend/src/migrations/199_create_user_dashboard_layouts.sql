-- Per-user dashboard layout customization
-- Stores the ordered list of widgets for each user. If a user has no row,
-- the frontend falls back to the default layout.
CREATE TABLE IF NOT EXISTS user_dashboard_layouts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  layout_json JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
