-- Add IPD Amount field to vp_contracts
-- IPD Amount (column BM in Vista) is a temporary contract placeholder used when no formal
-- contract or projection exists yet. When combined with a real backlog it adds to total exposure.
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS ipd_amount DECIMAL(15,2);
