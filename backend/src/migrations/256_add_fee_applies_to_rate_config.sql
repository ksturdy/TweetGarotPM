-- Per-category fee applicability flags for Rate/Fee Analysis
ALTER TABLE cost_control_rate_config
  ADD COLUMN IF NOT EXISTS fee_applies_labor        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fee_applies_material     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fee_applies_equipment    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fee_applies_subcontract  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fee_applies_gc           BOOLEAN NOT NULL DEFAULT true;
