-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  customer_facility VARCHAR(500),
  customer_owner VARCHAR(500),
  account_manager VARCHAR(255),
  field_leads TEXT,
  customer_number VARCHAR(100),
  address VARCHAR(500),
  city VARCHAR(255),
  state VARCHAR(100),
  zip_code VARCHAR(50),
  controls VARCHAR(255),
  department VARCHAR(255),
  customer_score DECIMAL(10, 2),
  active_customer BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on customer_owner for faster searches
CREATE INDEX idx_customers_owner ON customers(customer_owner);
CREATE INDEX idx_customers_facility ON customers(customer_facility);
CREATE INDEX idx_customers_active ON customers(active_customer);
CREATE INDEX idx_customers_account_manager ON customers(account_manager);
