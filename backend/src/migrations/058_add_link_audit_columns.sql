-- Add missing linked_at and linked_by columns to VP reference tables

-- VP Employees
ALTER TABLE vp_employees ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP;
ALTER TABLE vp_employees ADD COLUMN IF NOT EXISTS linked_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- VP Customers
ALTER TABLE vp_customers ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP;
ALTER TABLE vp_customers ADD COLUMN IF NOT EXISTS linked_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- VP Vendors
ALTER TABLE vp_vendors ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP;
ALTER TABLE vp_vendors ADD COLUMN IF NOT EXISTS linked_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
