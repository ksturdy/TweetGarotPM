ALTER TABLE cost_control_rate_config
  ADD COLUMN IF NOT EXISTS equipment_markup_pct DECIMAL(6,4) NOT NULL DEFAULT 0.0500;
