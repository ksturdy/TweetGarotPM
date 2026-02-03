-- Update project dates from Vista VP contract data
-- VP contracts store StartMonth and MonthClosed as Excel serial numbers
-- Excel serial number = days since 1899-12-30

-- Update start_date from VP contracts StartMonth
UPDATE projects p
SET start_date = DATE '1899-12-30' + (CAST(vc.raw_data->>'StartMonth' AS INTEGER) * INTERVAL '1 day')
FROM vp_contracts vc
WHERE vc.linked_project_id = p.id
  AND vc.raw_data->>'StartMonth' IS NOT NULL
  AND vc.raw_data->>'StartMonth' != ''
  AND vc.raw_data->>'StartMonth' ~ '^\d+$'
  AND p.start_date IS NULL;

-- Update end_date from VP contracts MonthClosed
UPDATE projects p
SET end_date = DATE '1899-12-30' + (CAST(vc.raw_data->>'MonthClosed' AS INTEGER) * INTERVAL '1 day')
FROM vp_contracts vc
WHERE vc.linked_project_id = p.id
  AND vc.raw_data->>'MonthClosed' IS NOT NULL
  AND vc.raw_data->>'MonthClosed' != ''
  AND vc.raw_data->>'MonthClosed' ~ '^\d+$'
  AND p.end_date IS NULL;

-- Also update projects that already have dates but we want Vista dates to take precedence
-- Uncomment below if you want to overwrite existing dates with Vista data
/*
UPDATE projects p
SET start_date = DATE '1899-12-30' + (CAST(vc.raw_data->>'StartMonth' AS INTEGER) * INTERVAL '1 day')
FROM vp_contracts vc
WHERE vc.linked_project_id = p.id
  AND vc.raw_data->>'StartMonth' IS NOT NULL
  AND vc.raw_data->>'StartMonth' != ''
  AND vc.raw_data->>'StartMonth' ~ '^\d+$';

UPDATE projects p
SET end_date = DATE '1899-12-30' + (CAST(vc.raw_data->>'MonthClosed' AS INTEGER) * INTERVAL '1 day')
FROM vp_contracts vc
WHERE vc.linked_project_id = p.id
  AND vc.raw_data->>'MonthClosed' IS NOT NULL
  AND vc.raw_data->>'MonthClosed' != ''
  AND vc.raw_data->>'MonthClosed' ~ '^\d+$';
*/
