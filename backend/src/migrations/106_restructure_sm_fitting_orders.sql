-- Migration: Restructure SM fitting orders to match actual Duct Work Fitting Order Sheet
-- Adds header fields for material/pressure/seam and creates line items table

-- Add new header fields to sm_fitting_orders
ALTER TABLE sm_fitting_orders
  ADD COLUMN IF NOT EXISTS requested_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS date_required DATE,
  ADD COLUMN IF NOT EXISTS material VARCHAR(255),
  ADD COLUMN IF NOT EXISTS static_pressure_class VARCHAR(100),
  ADD COLUMN IF NOT EXISTS longitudinal_seam VARCHAR(100),
  ADD COLUMN IF NOT EXISTS prepared_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS labor_phase_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS material_phase_code VARCHAR(50);

-- Make title nullable (no longer required - orders identified by number)
ALTER TABLE sm_fitting_orders ALTER COLUMN title DROP NOT NULL;

-- Create line items table matching the order sheet columns
CREATE TABLE IF NOT EXISTS sm_fitting_order_items (
  id SERIAL PRIMARY KEY,
  fitting_order_id INTEGER NOT NULL REFERENCES sm_fitting_orders(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 1,

  -- #REQ column
  quantity INTEGER DEFAULT 1,

  -- TYPE column (1-10 matching diagram numbers)
  fitting_type INTEGER CHECK (fitting_type BETWEEN 1 AND 10),

  -- Dimension columns
  dim_a VARCHAR(50),  -- A x B (stored as single string e.g. "24x12")
  dim_b VARCHAR(50),  -- B dimension (separate for flexibility)
  dim_c VARCHAR(50),  -- C x D
  dim_d VARCHAR(50),  -- D dimension
  dim_e VARCHAR(50),  -- E
  dim_f VARCHAR(50),  -- F (with UP/DN option)
  dim_l VARCHAR(50),  -- L (length)
  dim_r VARCHAR(50),  -- R (radius)
  dim_x VARCHAR(50),  -- X (angle/degrees or dimension)

  -- Specifications
  gauge VARCHAR(20),  -- GA
  liner VARCHAR(20),  -- .5", 1", or blank
  connection VARCHAR(20),  -- S&DR, TDC, Raw, V (Vanstone)

  -- Remarks
  remarks TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sm_fo_items_order ON sm_fitting_order_items(fitting_order_id);
CREATE INDEX IF NOT EXISTS idx_sm_fo_items_sort ON sm_fitting_order_items(fitting_order_id, sort_order);
