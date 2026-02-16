-- Add ship_address column to vp_contracts (street address from Vista contracts import)
ALTER TABLE vp_contracts ADD COLUMN IF NOT EXISTS ship_address VARCHAR(255);
