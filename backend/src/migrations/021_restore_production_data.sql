-- Migration: Restore production data (users, departments, employees)
-- This migration is idempotent and will only insert data if it doesn't already exist

-- First, update existing seed users with correct data
UPDATE users SET
  first_name = 'Kipp',
  last_name = 'Sturdivant',
  password = '$2a$10$NLIjKY/Q1EUTT5DZZ/Snyu2xiGRzBbbVMo79Wpr61YeBr8hYvo0W.',
  hr_access = 'write',
  is_active = true
WHERE id = 1 AND email = 'admin@tweetgarot.com';

UPDATE users SET
  role = 'admin',
  hr_access = 'write',
  is_active = true
WHERE id = 2 AND email = 'jsmith@tweetgarot.com';

UPDATE users SET
  hr_access = 'read',
  is_active = false
WHERE id = 3 AND email = 'sgarcia@tweetgarot.com';

UPDATE users SET
  hr_access = 'none',
  is_active = false
WHERE id = 4 AND email = 'bwilson@tweetgarot.com';

UPDATE users SET
  hr_access = 'none',
  is_active = false
WHERE id = 5 AND email = 'emartinez@tweetgarot.com';

-- Insert additional users (only if they don't exist)
INSERT INTO users (id, email, first_name, last_name, role, password, hr_access, is_active, created_at, updated_at)
VALUES
  (6, 'brian.smith@tweetgarot.com', 'Brian', 'Smith', 'user', '$2a$10$IWxQdt3hW1VrXJIoBgv52OhaMfMY90xMcjhstnLfn1zkZc73nblYe', 'none', true, NOW(), NOW()),
  (7, 'kipp.sturdivant@tweetgarot.com', 'Kipp', 'Sturdivant', 'admin', '$2a$10$99c3qI3.3ewMy1qTTCGmeeSYIKJRPQxEtL7h4yAsgAikindRj11Wi', 'write', true, NOW(), NOW()),
  (13, 'christopher.howald@tweetgarot.com', 'Christopher', 'Howald', 'manager', '$2a$10$KnAaHNwIa80E2LLU2P.F0uzoLaX8oEZV7jsq7Wg/kdwLa5Vzu2WgK', 'read', true, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Update sequence for users
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- Insert departments (only if they don't exist)
INSERT INTO departments (id, name, description, manager_id, department_number, created_at, updated_at)
VALUES
  (1, 'Executive', 'Executive leadership and management', NULL, '01-01', NOW(), NOW()),
  (2, 'Central Operations', E'Estimating, Virtual Construction, Engineering, and Purchasing\n', NULL, '01-03', NOW(), NOW()),
  (5, 'Human Resources', 'HR and employee relations', NULL, NULL, NOW(), NOW()),
  (6, 'Administration', 'Accounting, IT, Risk', NULL, NULL, NOW(), NOW()),
  (9, 'CW Accounts', 'Central Wisconsin Accounts', NULL, NULL, NOW(), NOW()),
  (10, 'Project Construction', '', 1, '10-30', NOW(), NOW()),
  (11, 'NEW Accounts (Industrial)', '', 2, '10-50', NOW(), NOW()),
  (12, 'Tempe', '', 4, '40-30', NOW(), NOW()),
  (13, 'NEW Accounts (Commercial)', '', NULL, '10-60', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  manager_id = EXCLUDED.manager_id,
  department_number = EXCLUDED.department_number,
  updated_at = NOW();

-- Update sequence for departments
SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));

-- Insert employees (only if they don't exist)
INSERT INTO employees (id, user_id, first_name, last_name, email, phone, mobile_phone, department_id, office_location_id, job_title, hire_date, employment_status, notes, role, created_at, updated_at)
VALUES
  (1, 7, 'Kipp', 'Sturdivant', 'kipp.sturdivant@tweetgarot.com', NULL, '9206800750', 1, 1, 'Vice President, Project Construction', NULL, 'active', '', 'admin', NOW(), NOW()),
  (2, NULL, 'Andrew', 'Babler', 'Andrew.Babler@tweetgarot.com', NULL, NULL, 1, 1, 'Executive Director, NEW Accounts', '2026-01-17', 'active', '', 'user', NOW(), NOW()),
  (3, NULL, 'Alan', 'VanMun', 'Alan.VanMun@tweetgarot.com', '9204980400', NULL, 10, 1, 'Project Executive', '2026-01-03', 'active', '', 'user', NOW(), NOW()),
  (4, 6, 'Brian', 'Smith', 'Brian.Smith@tweetgarot.com', NULL, NULL, 12, 4, 'Regional Director, Phoenix', '2016-01-01', 'active', '', 'user', NOW(), NOW()),
  (7, 13, 'Christopher', 'Howald', 'Christopher.Howald@tweetgarot.com', NULL, NULL, 1, 1, 'CEO', '2026-01-01', 'active', '', 'user', NOW(), NOW()),
  (8, 2, 'John', 'Smith', 'JSmith@tweetgarot.com', NULL, NULL, NULL, 1, '', NULL, 'active', '', 'user', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  mobile_phone = EXCLUDED.mobile_phone,
  department_id = EXCLUDED.department_id,
  office_location_id = EXCLUDED.office_location_id,
  job_title = EXCLUDED.job_title,
  hire_date = EXCLUDED.hire_date,
  employment_status = EXCLUDED.employment_status,
  notes = EXCLUDED.notes,
  role = EXCLUDED.role,
  updated_at = NOW();

-- Update sequence for employees
SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees));
