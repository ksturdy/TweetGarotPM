-- Add a customer contact reference to estimates so the form can capture the
-- specific person at the customer (bid recipient) the estimate is being sent to.
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS customer_contact_id INTEGER
    REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimates_customer_contact_id
  ON estimates(customer_contact_id);
