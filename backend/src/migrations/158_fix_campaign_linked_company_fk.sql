-- Fix campaign_companies.linked_company_id FK
-- It currently references companies (project stakeholders: GCs, architects, etc.)
-- but should reference customers (clients/prospects that campaigns target).
-- The CompanyPicker in the "Add New Prospect" modal loads from the customers table,
-- so this FK mismatch causes constraint violations when linking to an existing customer.

-- Drop the incorrect FK constraint
ALTER TABLE campaign_companies
  DROP CONSTRAINT IF EXISTS campaign_companies_linked_company_id_fkey;

-- Add the correct FK referencing customers
ALTER TABLE campaign_companies
  ADD CONSTRAINT campaign_companies_linked_company_id_fkey
  FOREIGN KEY (linked_company_id) REFERENCES customers(id);
