-- Migration 124: Add override fields for original estimated margin on projects
-- When NULL, values are inherited from the linked Vista contract (vp_contracts)
-- When set, the override value takes precedence for snapshots and performance charts

ALTER TABLE projects ADD COLUMN IF NOT EXISTS override_original_estimated_margin DECIMAL(15,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS override_original_estimated_margin_pct DECIMAL(8,4);

COMMENT ON COLUMN projects.override_original_estimated_margin IS 'User override for original estimated margin dollars. NULL = use Vista value.';
COMMENT ON COLUMN projects.override_original_estimated_margin_pct IS 'User override for original estimated margin percentage. NULL = use Vista value.';
