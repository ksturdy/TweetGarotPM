-- Expand spec columns from 2 to 5 per equipment row
-- Each section defines its own column set:
--   Major Equipment:       CFM, Cooling (tons/MBH), Heating (MBH), HP, Weight
--   Terminal & Zone Units: CFM, Cooling (MBH), Heating (MBH), HP
--   Ventilation & Exhaust: CFM, HP, Size
--   Piping & Accessories:  HP, GPM, Pipe Size, Gallons

ALTER TABLE project_equipment
  ADD COLUMN IF NOT EXISTS spec_3_label VARCHAR(50),
  ADD COLUMN IF NOT EXISTS spec_3_value DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS spec_3_unit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS spec_4_label VARCHAR(50),
  ADD COLUMN IF NOT EXISTS spec_4_value DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS spec_4_unit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS spec_5_label VARCHAR(50),
  ADD COLUMN IF NOT EXISTS spec_5_value DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS spec_5_unit VARCHAR(20);
