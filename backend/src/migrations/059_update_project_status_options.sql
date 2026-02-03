-- Migration: Update project status options to match Vista conventions
-- Vista uses: Open, Soft-Closed, Hard-Closed
-- We'll keep backwards compatibility with existing statuses

-- First, remove the existing constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Add new constraint with Vista-compatible statuses plus legacy statuses
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled', 'Open', 'Soft-Closed', 'Hard-Closed'));

-- Update existing 'active' projects that came from Vista imports to 'Open'
-- (We'll update based on VP contract status in a separate step)

-- Map legacy statuses to new ones for consistency (optional - uncomment if desired)
-- UPDATE projects SET status = 'Open' WHERE status = 'active';
-- UPDATE projects SET status = 'Hard-Closed' WHERE status = 'completed';

-- Update projects that were imported from VP contracts with their actual VP status
UPDATE projects p
SET status = COALESCE(NULLIF(vc.status, ''), 'Open')
FROM vp_contracts vc
WHERE vc.linked_project_id = p.id
  AND vc.status IS NOT NULL
  AND vc.status != '';

-- For VP contracts with empty/null status, set to 'Open'
UPDATE projects p
SET status = 'Open'
FROM vp_contracts vc
WHERE vc.linked_project_id = p.id
  AND (vc.status IS NULL OR vc.status = '')
  AND p.status = 'active';
