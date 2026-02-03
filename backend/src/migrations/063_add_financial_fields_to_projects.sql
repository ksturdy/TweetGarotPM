-- Add financial fields to projects table from Vista VP contracts

-- Add gross_margin_percent column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS gross_margin_percent DECIMAL(8, 2);

-- Add backlog column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS backlog DECIMAL(15, 2);

-- Update projects with gross margin percent from VP contracts
UPDATE projects p
SET gross_margin_percent = (vc.raw_data->'Gross Profit %')::numeric
FROM vp_contracts vc
WHERE vc.linked_project_id = p.id
  AND vc.raw_data->'Gross Profit %' IS NOT NULL
  AND p.gross_margin_percent IS NULL;

-- Update projects with backlog from VP contracts
UPDATE projects p
SET backlog = (vc.raw_data->' Backlog ')::numeric
FROM vp_contracts vc
WHERE vc.linked_project_id = p.id
  AND vc.raw_data->' Backlog ' IS NOT NULL
  AND p.backlog IS NULL;

-- Add comments
COMMENT ON COLUMN projects.gross_margin_percent IS 'Gross margin percentage from Vista ERP';
COMMENT ON COLUMN projects.backlog IS 'Remaining backlog amount from Vista ERP';
