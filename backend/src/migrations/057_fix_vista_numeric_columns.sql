-- Fix numeric column overflow issues in Vista tables

-- Increase precision for gross_profit_percent (can be larger than expected)
ALTER TABLE vp_contracts ALTER COLUMN gross_profit_percent TYPE DECIMAL(15,4);
ALTER TABLE vp_work_orders ALTER COLUMN gross_profit_percent TYPE DECIMAL(15,4);

-- Increase precision for hours columns in case of large values
ALTER TABLE vp_contracts ALTER COLUMN pf_hours_estimate TYPE DECIMAL(15,2);
ALTER TABLE vp_contracts ALTER COLUMN pf_hours_jtd TYPE DECIMAL(15,2);
ALTER TABLE vp_contracts ALTER COLUMN sm_hours_estimate TYPE DECIMAL(15,2);
ALTER TABLE vp_contracts ALTER COLUMN sm_hours_jtd TYPE DECIMAL(15,2);
ALTER TABLE vp_contracts ALTER COLUMN total_hours_estimate TYPE DECIMAL(15,2);
ALTER TABLE vp_contracts ALTER COLUMN total_hours_jtd TYPE DECIMAL(15,2);

ALTER TABLE vp_work_orders ALTER COLUMN pf_hours_jtd TYPE DECIMAL(15,2);
ALTER TABLE vp_work_orders ALTER COLUMN sm_hours_jtd TYPE DECIMAL(15,2);

-- Update vp_import_batches file_type constraint to include new types
ALTER TABLE vp_import_batches DROP CONSTRAINT IF EXISTS vp_import_batches_file_type_check;
ALTER TABLE vp_import_batches ADD CONSTRAINT vp_import_batches_file_type_check
  CHECK (file_type IN ('contracts', 'work_orders', 'employees', 'customers', 'vendors'));
