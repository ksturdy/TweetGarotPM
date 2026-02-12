-- Delete all test projects that were created before Vista import
-- Migration 073: Delete old test projects

-- First, delete attachments related to entities (RFIs, submittals, etc.) in these projects
-- Attachments use polymorphic relationship (entity_type, entity_id)

-- Delete attachments for RFIs in these projects
DELETE FROM attachments
WHERE entity_type = 'rfi'
  AND entity_id IN (SELECT id FROM rfis WHERE project_id IN (1, 2, 3, 4, 5, 6));

-- Delete attachments for Submittals in these projects
DELETE FROM attachments
WHERE entity_type = 'submittal'
  AND entity_id IN (SELECT id FROM submittals WHERE project_id IN (1, 2, 3, 4, 5, 6));

-- Delete attachments for Change Orders in these projects
DELETE FROM attachments
WHERE entity_type = 'change_order'
  AND entity_id IN (SELECT id FROM change_orders WHERE project_id IN (1, 2, 3, 4, 5, 6));

-- Now delete the test projects themselves
-- ON DELETE CASCADE will automatically delete related rfis, submittals, change_orders, daily_reports, and schedule_items
DELETE FROM projects
WHERE id IN (1, 2, 3, 4, 5, 6)
  OR (number LIKE 'P-2024-%' AND name IN (
    'Tech Park Data Center',
    'Lincoln High School Renovation',
    'Riverside Office Complex',
    'Downtown Medical Center HVAC',
    'Marriott Hotel Downtown'
  ))
  OR (number = '1126' AND name = 'Test New Project')
  OR (number = '11156' AND name LIKE '%Komico%');
