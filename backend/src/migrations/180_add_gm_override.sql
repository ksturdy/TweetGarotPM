-- Add override_gm_percent column to projects table
-- When set, overrides the Vista GM% for projects showing 100% GM (no cost projection yet)
-- The override is only applied when the real GM% is >= 99.5% (i.e. ~100%)
-- Once Vista posts a real GM%, the override is automatically bypassed at query time
ALTER TABLE projects ADD COLUMN IF NOT EXISTS override_gm_percent DECIMAL(8,4);
