-- Migration 217: Billing forecast support
--   - Project-level markup % per non-labor cost type (CT 2-6)
--   - Project-level labor rate pool (labels + $/hr)
--   - Per-phase-line FK to a labor rate

-- 1) Markup % columns on projects. NUMERIC(6,3) so 15.000% fits and we get
--    three decimal places of precision (15.125% is a real thing on some jobs).
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS billing_markup_material  NUMERIC(6,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_markup_subs      NUMERIC(6,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_markup_rentals   NUMERIC(6,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_markup_equipment NUMERIC(6,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_markup_genconds  NUMERIC(6,3) DEFAULT 0;

-- 2) Project labor rate pool
CREATE TABLE IF NOT EXISTS project_labor_rates (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    label VARCHAR(120) NOT NULL,
    billable_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_labor_rates_project ON project_labor_rates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_labor_rates_tenant ON project_labor_rates(tenant_id);

DROP TRIGGER IF EXISTS trigger_project_labor_rates_updated_at ON project_labor_rates;
CREATE TRIGGER trigger_project_labor_rates_updated_at
    BEFORE UPDATE ON project_labor_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3) Per-phase-line rate selection. SET NULL on rate delete so a deleted rate
--    just unrates the line instead of nuking the schedule row.
ALTER TABLE phase_schedule_items
  ADD COLUMN IF NOT EXISTS billable_rate_id INTEGER REFERENCES project_labor_rates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_phase_schedule_billable_rate ON phase_schedule_items(billable_rate_id);
