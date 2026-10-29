CREATE TABLE drawing_issue_pins (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(id),
  drawing_id     INTEGER NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  page_number    INTEGER NOT NULL,
  x              NUMERIC(8,6) NOT NULL,
  y              NUMERIC(8,6) NOT NULL,
  pin_number     INTEGER NOT NULL,
  field_issue_id INTEGER REFERENCES field_issues(id) ON DELETE SET NULL,
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE(drawing_id, page_number, pin_number)
);

CREATE TABLE drawing_submittal_tags (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id),
  drawing_id   INTEGER NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  page_number  INTEGER NOT NULL,
  x            NUMERIC(8,6) NOT NULL,
  y            NUMERIC(8,6) NOT NULL,
  width        NUMERIC(8,6) NOT NULL,
  height       NUMERIC(8,6) NOT NULL,
  submittal_id INTEGER REFERENCES submittals(id) ON DELETE SET NULL,
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dip_drawing ON drawing_issue_pins(drawing_id, page_number);
CREATE INDEX idx_dip_issue   ON drawing_issue_pins(field_issue_id);
CREATE INDEX idx_dst_drawing ON drawing_submittal_tags(drawing_id, page_number);
CREATE INDEX idx_dst_sub     ON drawing_submittal_tags(submittal_id);
