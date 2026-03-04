-- Migration 110: Change construction_type from VARCHAR to TEXT[] to support multiple selections
-- Also adds 'Addition' as a valid option

ALTER TABLE case_studies
  ALTER COLUMN construction_type TYPE TEXT[]
  USING CASE
    WHEN construction_type IS NOT NULL AND construction_type != ''
    THEN ARRAY[construction_type]
    ELSE NULL
  END;
