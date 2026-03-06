-- Migration: Create plumbing fitting order items table
-- Line items for plumbing fitting orders with quick-add foreman interface

CREATE TABLE IF NOT EXISTS plumbing_fitting_order_items (
  id SERIAL PRIMARY KEY,
  fitting_order_id INTEGER NOT NULL REFERENCES plumbing_fitting_orders(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 1,

  -- Fitting details
  fitting_type VARCHAR(50) NOT NULL,    -- '90', '45', 'tee', 'wye', 'reducer', 'coupling', 'union', 'cap', 'p_trap', 'cleanout', 'closet_flange', 'no_hub_coupling', 'adapter', 'bushing', 'pipe', 'other'
  size VARCHAR(50),                      -- pipe size: '1/2"', '3/4"', '1"', '2"', '3"', '4"', '6"', '8"', etc.
  join_type VARCHAR(50),                 -- 'no_hub', 'solvent_weld', 'soldered', 'threaded', 'propress', 'push_fit', 'crimp', 'glued'
  quantity INTEGER DEFAULT 1,

  -- Optional details
  remarks TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plumbing_foi_order ON plumbing_fitting_order_items(fitting_order_id);
CREATE INDEX IF NOT EXISTS idx_plumbing_foi_sort ON plumbing_fitting_order_items(fitting_order_id, sort_order);
