-- Migration: Create piping fitting order items table
-- Line items for piping fitting orders with quick-add foreman interface

CREATE TABLE IF NOT EXISTS piping_fitting_order_items (
  id SERIAL PRIMARY KEY,
  fitting_order_id INTEGER NOT NULL REFERENCES piping_fitting_orders(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 1,

  -- Fitting details
  fitting_type VARCHAR(50) NOT NULL,    -- '90', '45', 'tee', 'valve', 'pipe', 'reducer', 'cap', 'coupling', 'union', 'flange', 'nipple', 'bushing', 'wye', 'other'
  size VARCHAR(50),                      -- pipe size: '1/2"', '3/4"', '1"', '2"', etc.
  join_type VARCHAR(50),                 -- 'welded', 'threaded', 'flanged', 'grooved', 'press', 'soldered', 'glued'
  quantity INTEGER DEFAULT 1,

  -- Optional details
  remarks TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_piping_foi_order ON piping_fitting_order_items(fitting_order_id);
CREATE INDEX IF NOT EXISTS idx_piping_foi_sort ON piping_fitting_order_items(fitting_order_id, sort_order);
