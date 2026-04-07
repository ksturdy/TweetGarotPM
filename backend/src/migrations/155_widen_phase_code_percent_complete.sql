-- Widen percent_complete column to handle Vista values that exceed NUMERIC(8,4)
-- Vista can report percent_complete as raw values (e.g., 10000.0000 for 100%)
ALTER TABLE vp_phase_codes
  ALTER COLUMN percent_complete TYPE NUMERIC(12,4);
