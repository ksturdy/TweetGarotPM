-- Add organizational hierarchy support to customer_contacts table
-- This allows tracking reporting relationships between contacts

-- Add reports_to column for organizational hierarchy
ALTER TABLE customer_contacts
  ADD COLUMN IF NOT EXISTS reports_to INTEGER
  REFERENCES customer_contacts(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_contacts_reports_to
  ON customer_contacts(reports_to);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_reports
  ON customer_contacts(customer_id, reports_to);

-- Add comment for documentation
COMMENT ON COLUMN customer_contacts.reports_to IS
  'ID of the contact this person reports to (manager/supervisor). NULL for top-level contacts.';
