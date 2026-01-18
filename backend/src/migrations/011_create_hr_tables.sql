-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create office locations table
CREATE TABLE IF NOT EXISTS office_locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  mobile_phone VARCHAR(50),
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  office_location_id INTEGER REFERENCES office_locations(id) ON DELETE SET NULL,
  job_title VARCHAR(255),
  hire_date DATE,
  employment_status VARCHAR(50) DEFAULT 'active', -- active, inactive, terminated
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_location ON employees(office_location_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

-- Insert default departments
INSERT INTO departments (name, description) VALUES
  ('Executive', 'Executive leadership and management'),
  ('Operations', 'Field operations and project management'),
  ('Estimating', 'Project estimating and bidding'),
  ('Accounting', 'Finance and accounting'),
  ('Human Resources', 'HR and employee relations'),
  ('Safety', 'Safety and compliance'),
  ('Purchasing', 'Procurement and vendor management'),
  ('Service', 'Service and maintenance')
ON CONFLICT (name) DO NOTHING;

-- Insert default office locations
INSERT INTO office_locations (name, address, city, state, zip_code, phone) VALUES
  ('Main Office', '123 Main St', 'Indianapolis', 'IN', '46204', '(317) 555-0100'),
  ('North Branch', '456 North Ave', 'Carmel', 'IN', '46032', '(317) 555-0200'),
  ('South Branch', '789 South Blvd', 'Greenwood', 'IN', '46143', '(317) 555-0300')
ON CONFLICT (name) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hr_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_hr_updated_at();

CREATE TRIGGER office_locations_updated_at
  BEFORE UPDATE ON office_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_hr_updated_at();

CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_hr_updated_at();
