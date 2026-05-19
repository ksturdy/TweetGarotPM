-- Optimize vp_phase_codes for Cost Database aggregations.
-- The hot path is: filter by tenant_id + linked_project_id, then GROUP BY
-- cost_type and/or phase. Composite indexes enable index-only scans and
-- index-aided GROUP BY for queries that scan large slices of the table.

CREATE INDEX IF NOT EXISTS idx_vp_phase_codes_proj_ct
  ON vp_phase_codes (tenant_id, linked_project_id, cost_type)
  WHERE linked_project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vp_phase_codes_proj_phase_ct
  ON vp_phase_codes (tenant_id, linked_project_id, phase, cost_type)
  WHERE linked_project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vp_phase_codes_unlinked_contract
  ON vp_phase_codes (tenant_id, contract)
  WHERE linked_project_id IS NULL;
