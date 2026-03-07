-- Fix welded pipe rates: change from Extra Heavy to Standard Weight 21 FT
-- and add sizes 18" through 60" that were missing

-- Update existing rates (1/2" through 16")
UPDATE piping_productivity_rates SET hours_per_unit = 0.08 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '1/2"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.09 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '3/4"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.11 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '1"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.13 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '1-1/4"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.14 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '1-1/2"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.18 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '2"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.22 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '2-1/2"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.26 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '3"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.33 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '4"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.39 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '5"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.46 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '6"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.53 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '8"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.66 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '10"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.76 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '12"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.83 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '14"';
UPDATE piping_productivity_rates SET hours_per_unit = 0.88 WHERE tenant_id = 1 AND fitting_type = 'pipe' AND join_type = 'welded' AND pipe_diameter = '16"';

-- Add missing sizes (18" through 60")
INSERT INTO piping_productivity_rates (tenant_id, fitting_type, join_type, pipe_diameter, hours_per_unit, unit) VALUES
(1, 'pipe', 'welded', '3-1/2"', 0.29, 'LF'),
(1, 'pipe', 'welded', '18"', 0.94, 'LF'),
(1, 'pipe', 'welded', '20"', 1.00, 'LF'),
(1, 'pipe', 'welded', '24"', 1.12, 'LF'),
(1, 'pipe', 'welded', '30"', 1.29, 'LF'),
(1, 'pipe', 'welded', '36"', 1.46, 'LF'),
(1, 'pipe', 'welded', '42"', 1.64, 'LF'),
(1, 'pipe', 'welded', '48"', 1.81, 'LF'),
(1, 'pipe', 'welded', '54"', 1.99, 'LF'),
(1, 'pipe', 'welded', '60"', 2.16, 'LF');
