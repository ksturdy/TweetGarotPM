-- Migration 241: Labor accounts for service/accounts work (#67)
-- Employees can be assigned to a "labor account" (service contract location)
-- instead of a specific project so coordinators don't have to track every
-- individual work order when crews are doing recurring accounts work.

CREATE TABLE IF NOT EXISTS labor_accounts (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL,
  name            VARCHAR(255) NOT NULL,
  department_code VARCHAR(20),
  location        VARCHAR(255),
  customer_id     INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_labor_accounts_tenant ON labor_accounts(tenant_id, is_active);

-- Allow project_assignments to target a labor_account instead of a project.
-- Exactly one of project_id / labor_account_id must be non-null.
ALTER TABLE project_assignments
  ADD COLUMN IF NOT EXISTS labor_account_id INTEGER REFERENCES labor_accounts(id) ON DELETE SET NULL;

-- Partial indexes keep the unique constraint working for each target type
-- without colliding across the two assignment targets.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_employee_project_start
  ON project_assignments (employee_id, project_id, start_date)
  WHERE project_id IS NOT NULL AND labor_account_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pa_employee_account_start
  ON project_assignments (employee_id, labor_account_id, start_date)
  WHERE labor_account_id IS NOT NULL AND project_id IS NULL;
