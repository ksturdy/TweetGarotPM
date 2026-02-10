-- Migration 070: Switch campaign team system from users to employees
-- campaign_team_members and campaign_companies.assigned_to_id currently reference users(id)
-- They should reference employees(id) so the team is built from the employee directory

-- 1. Add employee_id column to campaign_team_members
ALTER TABLE campaign_team_members ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES employees(id);

-- 2. Backfill employee_id from existing user_id
UPDATE campaign_team_members ctm
SET employee_id = e.id
FROM employees e
WHERE e.user_id = ctm.user_id AND ctm.employee_id IS NULL;

-- 3. Drop the old FK on campaign_companies.assigned_to_id (references users)
ALTER TABLE campaign_companies DROP CONSTRAINT IF EXISTS campaign_companies_assigned_to_id_fkey;

-- 4. Backfill assigned_to_id: convert from user_id values to employee_id values
UPDATE campaign_companies cc
SET assigned_to_id = e.id
FROM employees e
WHERE e.user_id = cc.assigned_to_id;

-- 5. Add new FK referencing employees
ALTER TABLE campaign_companies ADD CONSTRAINT campaign_companies_assigned_to_employee_fkey
  FOREIGN KEY (assigned_to_id) REFERENCES employees(id);

-- 6. Drop old unique constraint on (campaign_id, user_id) and add new one on (campaign_id, employee_id)
ALTER TABLE campaign_team_members DROP CONSTRAINT IF EXISTS campaign_team_members_campaign_id_user_id_key;
ALTER TABLE campaign_team_members ADD CONSTRAINT campaign_team_members_campaign_employee_unique
  UNIQUE(campaign_id, employee_id);

-- 7. Make user_id nullable on campaign_team_members (employees may not have user accounts)
ALTER TABLE campaign_team_members ALTER COLUMN user_id DROP NOT NULL;

-- 8. Change campaigns.owner_id from users reference to employees reference
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_owner_id_fkey;

-- Backfill: convert owner_id from user_id to employee_id
UPDATE campaigns c
SET owner_id = e.id
FROM employees e
WHERE e.user_id = c.owner_id;

-- Add new FK referencing employees
ALTER TABLE campaigns ADD CONSTRAINT campaigns_owner_employee_fkey
  FOREIGN KEY (owner_id) REFERENCES employees(id);
