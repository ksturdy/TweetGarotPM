-- Multi-party support on estimates.
--
-- Roles:
--   owner_customer_id (existing customer_id)  — single Owner / facility funder
--   customer_ids        INT[]                 — companies receiving the bid (multi)
--   gc_customer_ids     INT[]                 — general contractors (multi, optional)
--   proposal_recipient_customer_id            — which Customer from customer_ids the
--                                                proposal letter is addressed to
--   customer_contact_id (existing)            — contact at the proposal recipient
--
-- The existing scalar columns (customer_id, gc_customer_id, customer_name,
-- general_contractor) stay populated as the "primary" denormalized values so
-- existing list/proposal queries continue to work without changes.

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS customer_ids INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN IF NOT EXISTS gc_customer_ids INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN IF NOT EXISTS proposal_recipient_customer_id INTEGER
    REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimates_customer_ids ON estimates USING GIN (customer_ids);
CREATE INDEX IF NOT EXISTS idx_estimates_gc_customer_ids ON estimates USING GIN (gc_customer_ids);
CREATE INDEX IF NOT EXISTS idx_estimates_proposal_recipient
  ON estimates(proposal_recipient_customer_id);

-- Backfill: any existing single customer_id flows into customer_ids[] (and becomes
-- the default proposal recipient). Same for gc_customer_id.
UPDATE estimates
SET customer_ids = ARRAY[customer_id]
WHERE customer_id IS NOT NULL
  AND (customer_ids IS NULL OR customer_ids = ARRAY[]::INTEGER[]);

UPDATE estimates
SET gc_customer_ids = ARRAY[gc_customer_id]
WHERE gc_customer_id IS NOT NULL
  AND (gc_customer_ids IS NULL OR gc_customer_ids = ARRAY[]::INTEGER[]);

UPDATE estimates
SET proposal_recipient_customer_id = customer_id
WHERE proposal_recipient_customer_id IS NULL
  AND customer_id IS NOT NULL;
