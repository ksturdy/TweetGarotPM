-- Add 'weekly_sales' to the report_type CHECK constraint on scheduled_reports
-- and create a team recipients table for sending reports to entire teams.

ALTER TABLE scheduled_reports
  DROP CONSTRAINT IF EXISTS scheduled_reports_report_type_check;

ALTER TABLE scheduled_reports
  ADD CONSTRAINT scheduled_reports_report_type_check
  CHECK (report_type IN (
    'executive_report',
    'backlog_fit',
    'cash_flow',
    'buyout_metric',
    'campaign',
    'opportunity_search',
    'weekly_sales'
  ));

-- Team-based recipients: allows sending a scheduled report to all members of a team
CREATE TABLE IF NOT EXISTS scheduled_report_team_recipients (
  id SERIAL PRIMARY KEY,
  scheduled_report_id INTEGER NOT NULL REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE (scheduled_report_id, team_id)
);
