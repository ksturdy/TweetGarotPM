-- Migration 240: Employee time-off / unavailability blocks (#69)
-- Separate table from project_assignments so assignment queries don't need
-- extra filtering. Stores vacation, FMLA, lay-off, and light-duty windows.

CREATE TABLE IF NOT EXISTS employee_time_off (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type          VARCHAR(20) NOT NULL CHECK (type IN ('vacation', 'fmla', 'laid_off', 'light_duty')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  notes         TEXT,
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT employee_time_off_date_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_eto_employee_tenant ON employee_time_off(employee_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_eto_date_range      ON employee_time_off(tenant_id, start_date, end_date);
