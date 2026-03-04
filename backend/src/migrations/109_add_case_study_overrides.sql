-- Migration 109: Add override fields for contact values and dates on case studies
-- When NULL, values are inherited from the linked customer/project
-- When set, the override value takes precedence

-- Contact overrides (from customer_contacts primary contact)
ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS override_contact_name VARCHAR(255);
ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS override_contact_title VARCHAR(255);
ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS override_contact_email VARCHAR(255);
ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS override_contact_phone VARCHAR(100);

-- Account manager override (from customer.account_manager)
ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS override_account_manager VARCHAR(255);

-- Date overrides (from project)
ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS override_start_date DATE;
ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS override_end_date DATE;

-- Value overrides (from project)
ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS override_contract_value DECIMAL(15,2);
ALTER TABLE case_studies ADD COLUMN IF NOT EXISTS override_square_footage INTEGER;
