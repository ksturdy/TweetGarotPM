-- Add location_id to customer_contacts so contacts can be associated with a specific customer location
ALTER TABLE customer_contacts
  ADD COLUMN IF NOT EXISTS location_id INTEGER
  REFERENCES customer_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_contacts_location
  ON customer_contacts(location_id);
