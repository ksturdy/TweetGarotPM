-- Add contract_value to projects table from Vista VP contracts

-- Add contract_value column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS contract_value DECIMAL(15, 2);

-- Create index for sorting/filtering by value
CREATE INDEX IF NOT EXISTS idx_projects_contract_value ON projects(contract_value);

-- Update projects with contract value from VP contracts
UPDATE projects p
SET contract_value = (vc.raw_data->' Contract Amt ')::numeric
FROM vp_contracts vc
WHERE vc.linked_project_id = p.id
  AND (vc.raw_data->' Contract Amt ')::numeric > 0
  AND p.contract_value IS NULL;

-- Add comment
COMMENT ON COLUMN projects.contract_value IS 'Contract value from Vista ERP integration';
