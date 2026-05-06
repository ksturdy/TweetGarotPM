-- Migration 198: Add "Pursuit" pipeline stage between Lead and Opportunity
--
-- Per the updated TITAN Pursuit Pipeline & Go/No-Go Guideline (2026-05):
--   Lead -> Pursuit (Gate 1: partial score, BD commitment)
--   Pursuit -> Opportunity (state change: invite received, no scoring)
--   Opportunity -> Quoted (Gate 2: full Go/No-Go, estimate commit)
--
-- Inserts Pursuit at display_order 2 and shifts the existing stages
-- (Opportunity, Quoted, Awarded, Lost, Passed) down by one position
-- per tenant. stage_id references on opportunities are unaffected since
-- only display_order changes.

-- 1. Shift Opportunity, Quoted, Awarded, Lost, Passed down by one position
--    (operate per tenant, ordered desc to avoid unique-constraint collisions).
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT DISTINCT tenant_id FROM pipeline_stages WHERE tenant_id IS NOT NULL LOOP
    UPDATE pipeline_stages SET display_order = 7 WHERE tenant_id = t.tenant_id AND name = 'Passed';
    UPDATE pipeline_stages SET display_order = 6 WHERE tenant_id = t.tenant_id AND name = 'Lost';
    UPDATE pipeline_stages SET display_order = 5 WHERE tenant_id = t.tenant_id AND name = 'Awarded';
    UPDATE pipeline_stages SET display_order = 4 WHERE tenant_id = t.tenant_id AND name = 'Quoted';
    UPDATE pipeline_stages SET display_order = 3 WHERE tenant_id = t.tenant_id AND name = 'Opportunity';
  END LOOP;
END $$;

-- 2. Insert Pursuit at display_order 2 for every tenant that doesn't have it yet.
INSERT INTO pipeline_stages (tenant_id, name, color, probability, display_order, is_active)
SELECT DISTINCT tenant_id, 'Pursuit', '#F59E0B', 'Low', 2, true
FROM pipeline_stages
WHERE tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pipeline_stages ps2
    WHERE ps2.tenant_id = pipeline_stages.tenant_id
      AND ps2.name = 'Pursuit'
  );

-- 3. Refresh comment.
COMMENT ON TABLE pipeline_stages IS 'Sales pipeline stages: Lead, Pursuit, Opportunity, Quoted, Awarded, Lost, Passed';
