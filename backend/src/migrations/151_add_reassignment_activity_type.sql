-- Add 'reassignment' to the campaign_activity_logs activity_type CHECK constraint
-- This was missing, causing prospect reassignment to fail silently
-- (the transaction would rollback because the CHECK constraint rejected 'reassignment')

ALTER TABLE campaign_activity_logs
  DROP CONSTRAINT IF EXISTS campaign_activity_logs_activity_type_check;

ALTER TABLE campaign_activity_logs
  ADD CONSTRAINT campaign_activity_logs_activity_type_check
  CHECK (activity_type IN (
    'status_change',
    'action_change',
    'note',
    'contact_attempt',
    'meeting',
    'email',
    'phone_call',
    'opportunity_created',
    'estimate_sent',
    'company_added_to_db',
    'reassignment'
  ));
