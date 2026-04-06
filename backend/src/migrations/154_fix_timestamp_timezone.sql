-- Fix imported_at columns: change TIMESTAMP to TIMESTAMPTZ
-- TIMESTAMP without timezone causes dates to be interpreted as local time in the browser,
-- showing wrong times when server timezone differs from user timezone.

ALTER TABLE vp_import_batches
  ALTER COLUMN imported_at TYPE TIMESTAMPTZ USING imported_at AT TIME ZONE 'America/Chicago';

ALTER TABLE vp_contracts
  ALTER COLUMN imported_at TYPE TIMESTAMPTZ USING imported_at AT TIME ZONE 'America/Chicago';

ALTER TABLE vp_work_orders
  ALTER COLUMN imported_at TYPE TIMESTAMPTZ USING imported_at AT TIME ZONE 'America/Chicago';
