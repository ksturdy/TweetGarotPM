-- Automated report scheduling
-- Allows users to configure reports to be generated and emailed on a recurring basis

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('executive_report', 'backlog_fit', 'cash_flow')),
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week SMALLINT CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month SMALLINT CHECK (day_of_month >= 1 AND day_of_month <= 28),
  time_of_day TIME NOT NULL DEFAULT '08:00',
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/Chicago',
  filters JSONB NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_reports_tenant ON scheduled_reports(tenant_id);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_enabled = true;

CREATE TABLE IF NOT EXISTS scheduled_report_recipients (
  id SERIAL PRIMARY KEY,
  scheduled_report_id INTEGER NOT NULL REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  UNIQUE(scheduled_report_id, user_id)
);

CREATE INDEX idx_scheduled_report_recipients_report ON scheduled_report_recipients(scheduled_report_id);
