CREATE TABLE IF NOT EXISTS snapshot_labels (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL,
  snapshot_date DATE NOT NULL,
  label        VARCHAR(100) NOT NULL,
  created_by   INTEGER REFERENCES users(id),
  updated_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, snapshot_date)
);
