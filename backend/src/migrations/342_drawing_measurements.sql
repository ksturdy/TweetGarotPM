CREATE TABLE drawing_scale_calibrations (
  id                SERIAL PRIMARY KEY,
  tenant_id         INTEGER NOT NULL REFERENCES tenants(id),
  drawing_id        INTEGER NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  page_number       INTEGER NOT NULL,
  x1                NUMERIC(8,6) NOT NULL,
  y1                NUMERIC(8,6) NOT NULL,
  x2                NUMERIC(8,6) NOT NULL,
  y2                NUMERIC(8,6) NOT NULL,
  real_world_value  NUMERIC(10,3) NOT NULL,
  real_world_unit   VARCHAR(20) NOT NULL DEFAULT 'ft',
  created_by        INTEGER REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(drawing_id, page_number)
);

CREATE TABLE drawing_measurements (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(id),
  drawing_id     INTEGER NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  page_number    INTEGER NOT NULL,
  measure_type   VARCHAR(20) NOT NULL,
  points         JSONB NOT NULL,
  computed_value NUMERIC(12,3),
  unit           VARCHAR(20),
  label          VARCHAR(100),
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dsc_drawing  ON drawing_scale_calibrations(drawing_id, page_number);
CREATE INDEX idx_dmeas_drawing ON drawing_measurements(drawing_id, page_number);
