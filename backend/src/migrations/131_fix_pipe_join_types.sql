-- Fix all NULL join_types and consolidate pipe data.
-- The original seed (migration 127) ran before join_type column existed, so all values are NULL.

-- Step 1: Delete ALL pipe rows and re-insert cleanly with correct join_types and STD WT values
DELETE FROM piping_productivity_rates WHERE fitting_type = 'pipe';

INSERT INTO piping_productivity_rates (tenant_id, fitting_type, join_type, pipe_diameter, hours_per_unit, unit) VALUES
(1, 'pipe', 'welded', '1/2"', 0.08, 'LF'),
(1, 'pipe', 'welded', '3/4"', 0.09, 'LF'),
(1, 'pipe', 'welded', '1"', 0.11, 'LF'),
(1, 'pipe', 'welded', '1-1/4"', 0.13, 'LF'),
(1, 'pipe', 'welded', '1-1/2"', 0.14, 'LF'),
(1, 'pipe', 'welded', '2"', 0.18, 'LF'),
(1, 'pipe', 'welded', '2-1/2"', 0.22, 'LF'),
(1, 'pipe', 'welded', '3"', 0.26, 'LF'),
(1, 'pipe', 'welded', '3-1/2"', 0.29, 'LF'),
(1, 'pipe', 'welded', '4"', 0.33, 'LF'),
(1, 'pipe', 'welded', '5"', 0.39, 'LF'),
(1, 'pipe', 'welded', '6"', 0.46, 'LF'),
(1, 'pipe', 'welded', '8"', 0.53, 'LF'),
(1, 'pipe', 'welded', '10"', 0.66, 'LF'),
(1, 'pipe', 'welded', '12"', 0.76, 'LF'),
(1, 'pipe', 'welded', '14"', 0.83, 'LF'),
(1, 'pipe', 'welded', '16"', 0.88, 'LF'),
(1, 'pipe', 'welded', '18"', 0.94, 'LF'),
(1, 'pipe', 'welded', '20"', 1.00, 'LF'),
(1, 'pipe', 'welded', '24"', 1.12, 'LF'),
(1, 'pipe', 'welded', '30"', 1.29, 'LF'),
(1, 'pipe', 'welded', '36"', 1.46, 'LF'),
(1, 'pipe', 'welded', '42"', 1.64, 'LF'),
(1, 'pipe', 'welded', '48"', 1.81, 'LF'),
(1, 'pipe', 'welded', '54"', 1.99, 'LF'),
(1, 'pipe', 'welded', '60"', 2.16, 'LF');

-- Step 2: Fix NULL join_types on all other fittings
-- BW STD WT Standard Fittings → welded
UPDATE piping_productivity_rates SET join_type = 'welded' WHERE join_type IS NULL AND fitting_type IN ('90_elbow', '45_elbow', 'tee', 'cap', 'reducer', 'valve', 'bushing');
-- GRV STD WT fittings → grooved
UPDATE piping_productivity_rates SET join_type = 'grooved' WHERE join_type IS NULL AND fitting_type IN ('flange', 'wye', 'coupling', 'nipple');
-- CU STD WT fittings → soldered
UPDATE piping_productivity_rates SET join_type = 'soldered' WHERE join_type IS NULL AND fitting_type = 'union';
