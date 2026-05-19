ALTER TABLE user_dashboard_layouts
  ADD COLUMN IF NOT EXISTS default_view_scope TEXT
    CHECK (default_view_scope IN ('my', 'team', 'company'));
