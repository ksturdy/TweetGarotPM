-- Add specification fields to project_equipment for capacity/sizing data
-- Primary spec: the most important capacity field (CFM, MBH, BTU, HP, tons, etc.)
-- Secondary spec: second most important field when applicable

ALTER TABLE project_equipment
  ADD COLUMN IF NOT EXISTS spec_1_label VARCHAR(50),
  ADD COLUMN IF NOT EXISTS spec_1_value DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS spec_1_unit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS spec_2_label VARCHAR(50),
  ADD COLUMN IF NOT EXISTS spec_2_value DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS spec_2_unit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS weight_lbs DECIMAL(10,2);
