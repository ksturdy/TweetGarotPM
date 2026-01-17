-- Create estimates table
CREATE TABLE IF NOT EXISTS estimates (
  id SERIAL PRIMARY KEY,
  estimate_number VARCHAR(50) UNIQUE NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255),

  -- Project details
  building_type VARCHAR(100),
  square_footage INTEGER,
  location VARCHAR(255),
  bid_date DATE,
  project_start_date DATE,
  project_duration INTEGER, -- in days

  -- Estimator info
  estimator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  estimator_name VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, pending, approved, rejected, won, lost

  -- Cost summary (calculated from line items)
  labor_cost DECIMAL(12, 2) DEFAULT 0,
  material_cost DECIMAL(12, 2) DEFAULT 0,
  equipment_cost DECIMAL(12, 2) DEFAULT 0,
  subcontractor_cost DECIMAL(12, 2) DEFAULT 0,
  rental_cost DECIMAL(12, 2) DEFAULT 0,

  subtotal DECIMAL(12, 2) DEFAULT 0,

  -- Percentages
  overhead_percentage DECIMAL(5, 2) DEFAULT 10.00,
  overhead_amount DECIMAL(12, 2) DEFAULT 0,

  profit_percentage DECIMAL(5, 2) DEFAULT 10.00,
  profit_amount DECIMAL(12, 2) DEFAULT 0,

  contingency_percentage DECIMAL(5, 2) DEFAULT 5.00,
  contingency_amount DECIMAL(12, 2) DEFAULT 0,

  -- Bond and insurance
  bond_percentage DECIMAL(5, 2) DEFAULT 0,
  bond_amount DECIMAL(12, 2) DEFAULT 0,

  -- Final totals
  total_cost DECIMAL(12, 2) DEFAULT 0,

  -- Notes and attachments
  scope_of_work TEXT,
  exclusions TEXT,
  assumptions TEXT,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,

  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Create estimate sections table (for organizing line items)
CREATE TABLE IF NOT EXISTS estimate_sections (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER REFERENCES estimates(id) ON DELETE CASCADE,
  section_name VARCHAR(255) NOT NULL,
  section_order INTEGER DEFAULT 0,
  description TEXT,

  -- Section totals (calculated from line items)
  labor_cost DECIMAL(12, 2) DEFAULT 0,
  material_cost DECIMAL(12, 2) DEFAULT 0,
  equipment_cost DECIMAL(12, 2) DEFAULT 0,
  subcontractor_cost DECIMAL(12, 2) DEFAULT 0,
  rental_cost DECIMAL(12, 2) DEFAULT 0,
  total_cost DECIMAL(12, 2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create estimate line items table
CREATE TABLE IF NOT EXISTS estimate_line_items (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER REFERENCES estimates(id) ON DELETE CASCADE,
  section_id INTEGER REFERENCES estimate_sections(id) ON DELETE CASCADE,

  item_order INTEGER DEFAULT 0,
  item_type VARCHAR(50) NOT NULL, -- labor, material, equipment, subcontractor, rental, other

  -- Item description
  description VARCHAR(500) NOT NULL,
  specification TEXT,
  notes TEXT,

  -- Quantity
  quantity DECIMAL(12, 2) DEFAULT 1,
  unit VARCHAR(50), -- EA, LF, SF, CY, HR, etc.

  -- Labor
  labor_hours DECIMAL(8, 2) DEFAULT 0,
  labor_rate DECIMAL(8, 2) DEFAULT 0,
  labor_cost DECIMAL(12, 2) DEFAULT 0,
  labor_burden_percentage DECIMAL(5, 2) DEFAULT 0, -- for benefits, taxes, etc.
  labor_burden_amount DECIMAL(12, 2) DEFAULT 0,

  -- Material
  material_unit_cost DECIMAL(12, 2) DEFAULT 0,
  material_cost DECIMAL(12, 2) DEFAULT 0,
  material_waste_percentage DECIMAL(5, 2) DEFAULT 0,
  material_waste_amount DECIMAL(12, 2) DEFAULT 0,

  -- Equipment
  equipment_unit_cost DECIMAL(12, 2) DEFAULT 0,
  equipment_cost DECIMAL(12, 2) DEFAULT 0,

  -- Subcontractor
  subcontractor_name VARCHAR(255),
  subcontractor_cost DECIMAL(12, 2) DEFAULT 0,

  -- Rental
  rental_description VARCHAR(255),
  rental_duration DECIMAL(8, 2) DEFAULT 0, -- days, weeks, months
  rental_rate DECIMAL(12, 2) DEFAULT 0,
  rental_cost DECIMAL(12, 2) DEFAULT 0,

  -- Total for this line item
  total_cost DECIMAL(12, 2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create estimate templates table (for saving common estimate structures)
CREATE TABLE IF NOT EXISTS estimate_templates (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(255) NOT NULL,
  description TEXT,
  building_type VARCHAR(100),

  -- Default percentages
  overhead_percentage DECIMAL(5, 2) DEFAULT 10.00,
  profit_percentage DECIMAL(5, 2) DEFAULT 10.00,
  contingency_percentage DECIMAL(5, 2) DEFAULT 5.00,

  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create estimate template sections
CREATE TABLE IF NOT EXISTS estimate_template_sections (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES estimate_templates(id) ON DELETE CASCADE,
  section_name VARCHAR(255) NOT NULL,
  section_order INTEGER DEFAULT 0,
  description TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create estimate template line items
CREATE TABLE IF NOT EXISTS estimate_template_items (
  id SERIAL PRIMARY KEY,
  template_section_id INTEGER REFERENCES estimate_template_sections(id) ON DELETE CASCADE,

  item_order INTEGER DEFAULT 0,
  item_type VARCHAR(50) NOT NULL,
  description VARCHAR(500) NOT NULL,
  specification TEXT,
  unit VARCHAR(50),

  -- Default rates/costs
  default_labor_rate DECIMAL(8, 2) DEFAULT 0,
  default_labor_burden_percentage DECIMAL(5, 2) DEFAULT 0,
  default_material_waste_percentage DECIMAL(5, 2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_estimates_customer ON estimates(customer_id);
CREATE INDEX idx_estimates_estimator ON estimates(estimator_id);
CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_estimates_bid_date ON estimates(bid_date);
CREATE INDEX idx_estimate_sections_estimate ON estimate_sections(estimate_id);
CREATE INDEX idx_estimate_line_items_estimate ON estimate_line_items(estimate_id);
CREATE INDEX idx_estimate_line_items_section ON estimate_line_items(section_id);
CREATE INDEX idx_estimate_templates_building_type ON estimate_templates(building_type);

-- Create function to update estimate totals
CREATE OR REPLACE FUNCTION update_estimate_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update section totals
  UPDATE estimate_sections
  SET
    labor_cost = COALESCE((
      SELECT SUM(labor_cost + labor_burden_amount)
      FROM estimate_line_items
      WHERE section_id = estimate_sections.id
    ), 0),
    material_cost = COALESCE((
      SELECT SUM(material_cost + material_waste_amount)
      FROM estimate_line_items
      WHERE section_id = estimate_sections.id
    ), 0),
    equipment_cost = COALESCE((
      SELECT SUM(equipment_cost)
      FROM estimate_line_items
      WHERE section_id = estimate_sections.id
    ), 0),
    subcontractor_cost = COALESCE((
      SELECT SUM(subcontractor_cost)
      FROM estimate_line_items
      WHERE section_id = estimate_sections.id
    ), 0),
    rental_cost = COALESCE((
      SELECT SUM(rental_cost)
      FROM estimate_line_items
      WHERE section_id = estimate_sections.id
    ), 0),
    total_cost = COALESCE((
      SELECT SUM(total_cost)
      FROM estimate_line_items
      WHERE section_id = estimate_sections.id
    ), 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = COALESCE(NEW.section_id, OLD.section_id);

  -- Update estimate totals
  UPDATE estimates
  SET
    labor_cost = COALESCE((
      SELECT SUM(labor_cost + labor_burden_amount)
      FROM estimate_line_items
      WHERE estimate_id = estimates.id
    ), 0),
    material_cost = COALESCE((
      SELECT SUM(material_cost + material_waste_amount)
      FROM estimate_line_items
      WHERE estimate_id = estimates.id
    ), 0),
    equipment_cost = COALESCE((
      SELECT SUM(equipment_cost)
      FROM estimate_line_items
      WHERE estimate_id = estimates.id
    ), 0),
    subcontractor_cost = COALESCE((
      SELECT SUM(subcontractor_cost)
      FROM estimate_line_items
      WHERE estimate_id = estimates.id
    ), 0),
    rental_cost = COALESCE((
      SELECT SUM(rental_cost)
      FROM estimate_line_items
      WHERE estimate_id = estimates.id
    ), 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  -- Calculate subtotal, overhead, profit, and total
  UPDATE estimates
  SET
    subtotal = labor_cost + material_cost + equipment_cost + subcontractor_cost + rental_cost,
    overhead_amount = (labor_cost + material_cost + equipment_cost + subcontractor_cost + rental_cost) * (overhead_percentage / 100),
    profit_amount = (labor_cost + material_cost + equipment_cost + subcontractor_cost + rental_cost +
                    ((labor_cost + material_cost + equipment_cost + subcontractor_cost + rental_cost) * (overhead_percentage / 100))) * (profit_percentage / 100),
    contingency_amount = (labor_cost + material_cost + equipment_cost + subcontractor_cost + rental_cost) * (contingency_percentage / 100),
    bond_amount = (labor_cost + material_cost + equipment_cost + subcontractor_cost + rental_cost) * (bond_percentage / 100)
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  -- Calculate final total
  UPDATE estimates
  SET
    total_cost = subtotal + overhead_amount + profit_amount + contingency_amount + bond_amount
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trg_estimate_line_items_update
AFTER INSERT OR UPDATE OR DELETE ON estimate_line_items
FOR EACH ROW
EXECUTE FUNCTION update_estimate_totals();

-- Create trigger to update estimate percentages
CREATE OR REPLACE FUNCTION update_estimate_percentage_totals()
RETURNS TRIGGER AS $$
BEGIN
  NEW.subtotal := NEW.labor_cost + NEW.material_cost + NEW.equipment_cost + NEW.subcontractor_cost + NEW.rental_cost;
  NEW.overhead_amount := NEW.subtotal * (NEW.overhead_percentage / 100);
  NEW.profit_amount := (NEW.subtotal + NEW.overhead_amount) * (NEW.profit_percentage / 100);
  NEW.contingency_amount := NEW.subtotal * (NEW.contingency_percentage / 100);
  NEW.bond_amount := NEW.subtotal * (NEW.bond_percentage / 100);
  NEW.total_cost := NEW.subtotal + NEW.overhead_amount + NEW.profit_amount + NEW.contingency_amount + NEW.bond_amount;
  NEW.updated_at := CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_estimates_percentage_update
BEFORE UPDATE ON estimates
FOR EACH ROW
WHEN (
  OLD.overhead_percentage IS DISTINCT FROM NEW.overhead_percentage OR
  OLD.profit_percentage IS DISTINCT FROM NEW.profit_percentage OR
  OLD.contingency_percentage IS DISTINCT FROM NEW.contingency_percentage OR
  OLD.bond_percentage IS DISTINCT FROM NEW.bond_percentage
)
EXECUTE FUNCTION update_estimate_percentage_totals();
