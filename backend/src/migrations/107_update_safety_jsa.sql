-- Migration: Update safety_jsa to match actual JSA - Jobsite Safety Analysis form
-- Adds permits, equipment checkboxes, department/trade, worker sign-in

-- Add new fields to safety_jsa
ALTER TABLE safety_jsa
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS department_trade VARCHAR(255),
  ADD COLUMN IF NOT EXISTS filled_out_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS permits_required JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS equipment_required JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS additional_comments TEXT;

-- Update safety_jsa_hazards to match 3-column format: Major Tasks, Potential Hazards, Control Action
-- Current columns: step_description, hazard, control_measure, responsible_person
-- The existing columns map well: step_description->major_task, hazard->potential_hazard, control_measure->control_action
-- Just add aliases - no structural change needed, responsible_person becomes optional

-- Replace signatures table concept with simpler worker sign-in
-- The existing safety_jsa_signatures table has employee_name + signature_data
-- For the actual form, workers just print their name (no digital signature needed)
-- We'll keep the table but make signature_data optional
ALTER TABLE safety_jsa_signatures
  ALTER COLUMN signature_data DROP NOT NULL;

-- Add a simple worker_sign_in JSONB array as alternative to the signatures table
ALTER TABLE safety_jsa
  ADD COLUMN IF NOT EXISTS worker_names JSONB DEFAULT '[]';
