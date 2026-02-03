-- Vista Employees table (from TGPREmployees sheet)
CREATE TABLE IF NOT EXISTS vp_employees (
  id SERIAL PRIMARY KEY,
  employee_number INTEGER UNIQUE NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  hire_date DATE,
  active BOOLEAN DEFAULT true,

  -- Link to Titan employees
  linked_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  link_status VARCHAR(50) DEFAULT 'unmatched',

  -- Raw data from Vista
  raw_data JSONB,

  -- Tracking
  import_batch_id INTEGER REFERENCES vp_import_batches(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vista Customers table (from TGARCustomers sheet)
CREATE TABLE IF NOT EXISTS vp_customers (
  id SERIAL PRIMARY KEY,
  customer_number INTEGER UNIQUE NOT NULL,
  name VARCHAR(500),
  address VARCHAR(500),
  address2 VARCHAR(500),
  city VARCHAR(255),
  state VARCHAR(50),
  zip VARCHAR(20),
  active BOOLEAN DEFAULT true,

  -- Link to Titan customers
  linked_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  link_status VARCHAR(50) DEFAULT 'unmatched',

  -- Raw data from Vista
  raw_data JSONB,

  -- Tracking
  import_batch_id INTEGER REFERENCES vp_import_batches(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vista Vendors table (from TGAPVendors sheet)
CREATE TABLE IF NOT EXISTS vp_vendors (
  id SERIAL PRIMARY KEY,
  vendor_number INTEGER UNIQUE NOT NULL,
  name VARCHAR(500),
  address VARCHAR(500),
  address2 VARCHAR(500),
  city VARCHAR(255),
  state VARCHAR(50),
  zip VARCHAR(20),
  active BOOLEAN DEFAULT true,

  -- Link to Titan vendors (if vendor table exists, otherwise null)
  linked_vendor_id INTEGER,
  link_status VARCHAR(50) DEFAULT 'unmatched',

  -- Raw data from Vista
  raw_data JSONB,

  -- Tracking
  import_batch_id INTEGER REFERENCES vp_import_batches(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vp_employees_link_status ON vp_employees(link_status);
CREATE INDEX IF NOT EXISTS idx_vp_employees_linked ON vp_employees(linked_employee_id);
CREATE INDEX IF NOT EXISTS idx_vp_employees_active ON vp_employees(active);

CREATE INDEX IF NOT EXISTS idx_vp_customers_link_status ON vp_customers(link_status);
CREATE INDEX IF NOT EXISTS idx_vp_customers_linked ON vp_customers(linked_customer_id);
CREATE INDEX IF NOT EXISTS idx_vp_customers_active ON vp_customers(active);
CREATE INDEX IF NOT EXISTS idx_vp_customers_name ON vp_customers(name);

CREATE INDEX IF NOT EXISTS idx_vp_vendors_link_status ON vp_vendors(link_status);
CREATE INDEX IF NOT EXISTS idx_vp_vendors_active ON vp_vendors(active);
CREATE INDEX IF NOT EXISTS idx_vp_vendors_name ON vp_vendors(name);

-- Update vp_import_batches to support new file types
-- The file_type column already exists, just adding comment
-- Valid file_types: 'contracts', 'work_orders', 'employees', 'customers', 'vendors'
