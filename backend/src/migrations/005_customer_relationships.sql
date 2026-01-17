-- Add customer relationships and touchpoints

-- Add customer_id to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_id);

-- Add customer_id to historical_projects table (bids)
ALTER TABLE historical_projects
ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_historical_projects_customer ON historical_projects(customer_id);

-- Create touchpoints table for customer interactions
CREATE TABLE IF NOT EXISTS customer_touchpoints (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  touchpoint_date DATE NOT NULL,
  touchpoint_type VARCHAR(100) NOT NULL,
  contact_person VARCHAR(255),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_touchpoints_customer ON customer_touchpoints(customer_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_date ON customer_touchpoints(touchpoint_date);
