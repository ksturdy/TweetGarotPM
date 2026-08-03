ALTER TABLE cost_control_matrices
  ADD COLUMN IF NOT EXISTS estimate_id INTEGER REFERENCES estimates(id) ON DELETE SET NULL;
