-- Rate / Fee Analysis tables for Cost Control Matrix
-- One config row per matrix (fee structure + non-labor cost inputs)
-- One labor row per matrix × trade × classification (hours and rates)

CREATE TABLE IF NOT EXISTS cost_control_rate_config (
  id                   SERIAL PRIMARY KEY,
  matrix_id            INTEGER NOT NULL UNIQUE REFERENCES cost_control_matrices(id) ON DELETE CASCADE,
  construction_fee_pct DECIMAL(6,4) NOT NULL DEFAULT 0.0600,
  material_markup_pct  DECIMAL(6,4) NOT NULL DEFAULT 0.0500,
  sub_markup_pct       DECIMAL(6,4) NOT NULL DEFAULT 0.0500,
  -- Non-labor cost inputs (entered in dollar amounts)
  material_cost        DECIMAL(16,2) NOT NULL DEFAULT 0,
  equipment_cost       DECIMAL(16,2) NOT NULL DEFAULT 0,
  subcontract_cost     DECIMAL(16,2) NOT NULL DEFAULT 0,
  gen_conditions_cost  DECIMAL(16,2) NOT NULL DEFAULT 0,
  notes                TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cost_control_rate_labor (
  id               SERIAL PRIMARY KEY,
  matrix_id        INTEGER NOT NULL REFERENCES cost_control_matrices(id) ON DELETE CASCADE,
  trade            VARCHAR(50) NOT NULL,
  classification   VARCHAR(50) NOT NULL,
  estimated_hours  DECIMAL(10,2) NOT NULL DEFAULT 0,
  actual_rate      DECIMAL(10,4) NOT NULL DEFAULT 0,
  billable_rate    DECIMAL(10,4) NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (matrix_id, trade, classification)
);

CREATE INDEX IF NOT EXISTS idx_ccrl_matrix_id ON cost_control_rate_labor(matrix_id);
