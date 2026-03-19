-- Add EST catalog filter columns to pipe_specs table
-- These store the user's EST product catalog filter selections per spec

ALTER TABLE pipe_specs
  ADD COLUMN IF NOT EXISTS est_install_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS est_material VARCHAR(100),
  ADD COLUMN IF NOT EXISTS est_filters JSONB DEFAULT '{}';
