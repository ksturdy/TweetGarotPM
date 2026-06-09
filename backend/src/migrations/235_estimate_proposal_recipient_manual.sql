-- Manual-entry overrides for the proposal recipient and recipient contact,
-- so users can address a proposal to a person/company that isn't a saved
-- customer or contact record yet.
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS proposal_recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS proposal_recipient_contact_name TEXT;
