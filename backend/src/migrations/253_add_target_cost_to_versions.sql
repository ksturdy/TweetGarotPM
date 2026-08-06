-- Add per-version target cost, fee %, and overhead % so each version
-- can track its own negotiated rates alongside the estimate grand total
ALTER TABLE cost_control_versions
  ADD COLUMN IF NOT EXISTS target_cost DECIMAL(16, 2),
  ADD COLUMN IF NOT EXISTS fee_pct DECIMAL(6, 4),
  ADD COLUMN IF NOT EXISTS overhead_pct DECIMAL(6, 4);
