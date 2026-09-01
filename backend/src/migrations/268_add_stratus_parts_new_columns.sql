-- Add new columns from updated Stratus tracking export format.
-- FabCompleteDate renamed to FabCompleteDT in new exports; we keep
-- the existing fab_complete_date column and populate it from either.
ALTER TABLE stratus_parts
  ADD COLUMN IF NOT EXISTS package_name              VARCHAR(255),
  ADD COLUMN IF NOT EXISTS package_number            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS weld_inches_complete      NUMERIC,
  ADD COLUMN IF NOT EXISTS wps                       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS total_welds_complete      NUMERIC,
  ADD COLUMN IF NOT EXISTS assemblies_count          NUMERIC,
  ADD COLUMN IF NOT EXISTS product_short_description VARCHAR(500),
  ADD COLUMN IF NOT EXISTS shop_weld_inches          NUMERIC,
  ADD COLUMN IF NOT EXISTS field_weld_inches         NUMERIC;
