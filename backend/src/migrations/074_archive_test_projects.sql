-- Archive old test projects that shouldn't appear in active projects list
-- Migration 072: Archive test projects by marking them as cancelled

-- Update the status of known test projects to 'cancelled'
UPDATE projects
SET status = 'cancelled', updated_at = NOW()
WHERE id IN (5, 6) -- Tech Park Data Center, Komico Revovations
  AND (name = 'Tech Park Data Center' OR name = 'Komico Revovations');

-- Also cancel other seed test projects if they exist
UPDATE projects
SET status = 'cancelled', updated_at = NOW()
WHERE name IN (
  'Downtown Medical Center HVAC',
  'Riverside Office Complex',
  'Lincoln High School Renovation',
  'Marriott Hotel Downtown'
)
AND (number LIKE 'P-2024-%' OR number LIKE 'P-2023-%');
