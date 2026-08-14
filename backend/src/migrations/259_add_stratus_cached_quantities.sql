ALTER TABLE phase_schedule_items
  ADD COLUMN IF NOT EXISTS stratus_qty_lf        NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS stratus_installed_lf   NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS stratus_qty_count      NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS stratus_installed_count NUMERIC(14,2);
