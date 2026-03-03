-- Add total_projected_cost column to phase_schedule_items (from Vista projected_cost)
ALTER TABLE phase_schedule_items ADD COLUMN IF NOT EXISTS total_projected_cost NUMERIC(14,2) DEFAULT 0;

-- Backfill from linked vp_phase_codes
UPDATE phase_schedule_items psi
SET total_projected_cost = sub.sum_projected_cost
FROM (
  SELECT psi2.id, COALESCE(SUM(pc.projected_cost), 0) as sum_projected_cost
  FROM phase_schedule_items psi2
  CROSS JOIN LATERAL unnest(psi2.phase_code_ids) AS pcid
  JOIN vp_phase_codes pc ON pc.id = pcid
  GROUP BY psi2.id
) sub
WHERE psi.id = sub.id;
