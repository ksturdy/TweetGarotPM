-- Add join_type column to piping_productivity_rates for join-type-specific rates
ALTER TABLE piping_productivity_rates ADD COLUMN IF NOT EXISTS join_type VARCHAR(50);

-- Drop old unique index and create new one including join_type
DROP INDEX IF EXISTS idx_prod_rates_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prod_rates_unique
  ON piping_productivity_rates(tenant_id, fitting_type, COALESCE(join_type, ''), pipe_diameter);
