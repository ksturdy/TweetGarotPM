-- Add 'phase_report' to the report_type CHECK constraint on scheduled_reports

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
    'weekly_sales',
    'labor_forecast',
    'projected_revenue',
    'pm_report',
    'phase_report'
  ));
