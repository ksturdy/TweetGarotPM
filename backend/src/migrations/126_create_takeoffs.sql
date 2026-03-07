-- Migration: Create takeoff tables for estimating piping labor hours
-- Includes productivity rates lookup, takeoff headers, and takeoff line items

-- Table: piping_productivity_rates
-- Stores hours-per-unit lookup data from the Piping Productivity Rates spreadsheet
CREATE TABLE IF NOT EXISTS piping_productivity_rates (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  fitting_type VARCHAR(50) NOT NULL,        -- '90_elbow', '45_elbow', 'tee', 'reducer', 'coupling', 'union', 'cap', 'flange', 'wye', 'nipple', 'lateral', 'pipe'
  join_type VARCHAR(50),                     -- 'welded', 'threaded', 'grooved', 'soldered'
  pipe_diameter VARCHAR(20) NOT NULL,        -- '1/2"', '3/4"', '1"', etc.
  hours_per_unit DECIMAL(8,4) NOT NULL,      -- hours per fitting (EA) or per linear foot (LF)
  unit VARCHAR(10) DEFAULT 'EA'              -- 'EA' for fittings, 'LF' for pipe
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prod_rates_unique
  ON piping_productivity_rates(tenant_id, fitting_type, COALESCE(join_type, ''), pipe_diameter);
CREATE INDEX IF NOT EXISTS idx_prod_rates_lookup
  ON piping_productivity_rates(tenant_id, fitting_type, pipe_diameter);

-- Table: takeoffs
-- Main takeoff header, tenant-scoped with optional estimate linkage
CREATE TABLE IF NOT EXISTS takeoffs (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  takeoff_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Optional linkage to an estimate
  estimate_id INTEGER REFERENCES estimates(id) ON DELETE SET NULL,

  -- Performance factor: percentage adjustment on productivity rates
  -- Negative = faster (e.g. -35 means 35% faster), positive = slower (e.g. +10 means 10% slower)
  performance_factor DECIMAL(5,2) DEFAULT 0,

  -- Calculated summary fields (updated by trigger)
  total_base_hours DECIMAL(10,2) DEFAULT 0,
  total_adjusted_hours DECIMAL(10,2) DEFAULT 0,
  total_material_cost DECIMAL(12,2) DEFAULT 0,
  total_items INTEGER DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'complete')),

  -- Metadata
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tenant_id, takeoff_number)
);

CREATE INDEX IF NOT EXISTS idx_takeoffs_tenant ON takeoffs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_takeoffs_estimate ON takeoffs(estimate_id);
CREATE INDEX IF NOT EXISTS idx_takeoffs_status ON takeoffs(status);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_takeoffs_updated_at ON takeoffs;
CREATE TRIGGER update_takeoffs_updated_at
  BEFORE UPDATE ON takeoffs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Table: takeoff_items
-- Line items with calculated labor hours
CREATE TABLE IF NOT EXISTS takeoff_items (
  id SERIAL PRIMARY KEY,
  takeoff_id INTEGER NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 1,

  -- Fitting details
  fitting_type VARCHAR(50) NOT NULL,
  size VARCHAR(50) NOT NULL,
  join_type VARCHAR(50),
  quantity DECIMAL(10,2) DEFAULT 1,

  -- Productivity rate lookup result
  base_hours_per_unit DECIMAL(8,4) DEFAULT 0,
  base_hours_total DECIMAL(10,4) DEFAULT 0,

  -- Adjusted hours (after performance factor)
  adjusted_hours DECIMAL(10,4) DEFAULT 0,

  -- Optional material pricing
  material_unit_cost DECIMAL(12,2) DEFAULT 0,
  material_cost DECIMAL(12,2) DEFAULT 0,

  -- Optional details
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_takeoff_items_takeoff ON takeoff_items(takeoff_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_items_sort ON takeoff_items(takeoff_id, sort_order);

-- Trigger to recalculate takeoff totals when items change
CREATE OR REPLACE FUNCTION update_takeoff_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_takeoff_id INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_takeoff_id := OLD.takeoff_id;
  ELSE
    v_takeoff_id := NEW.takeoff_id;
  END IF;

  UPDATE takeoffs
  SET
    total_items = COALESCE((
      SELECT COUNT(*) FROM takeoff_items WHERE takeoff_id = v_takeoff_id
    ), 0),
    total_base_hours = COALESCE((
      SELECT SUM(base_hours_total) FROM takeoff_items WHERE takeoff_id = v_takeoff_id
    ), 0),
    total_adjusted_hours = COALESCE((
      SELECT SUM(adjusted_hours) FROM takeoff_items WHERE takeoff_id = v_takeoff_id
    ), 0),
    total_material_cost = COALESCE((
      SELECT SUM(material_cost) FROM takeoff_items WHERE takeoff_id = v_takeoff_id
    ), 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = v_takeoff_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_takeoff_items_insert ON takeoff_items;
CREATE TRIGGER trg_takeoff_items_insert
AFTER INSERT ON takeoff_items
FOR EACH ROW EXECUTE FUNCTION update_takeoff_totals();

DROP TRIGGER IF EXISTS trg_takeoff_items_update ON takeoff_items;
CREATE TRIGGER trg_takeoff_items_update
AFTER UPDATE ON takeoff_items
FOR EACH ROW EXECUTE FUNCTION update_takeoff_totals();

DROP TRIGGER IF EXISTS trg_takeoff_items_delete ON takeoff_items;
CREATE TRIGGER trg_takeoff_items_delete
AFTER DELETE ON takeoff_items
FOR EACH ROW EXECUTE FUNCTION update_takeoff_totals();
