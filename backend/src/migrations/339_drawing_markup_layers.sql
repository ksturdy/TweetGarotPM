CREATE TABLE drawing_markup_layers (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id),
  drawing_id  INTEGER NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL DEFAULT 1,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7) NOT NULL DEFAULT '#FF0000',
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  is_personal BOOLEAN NOT NULL DEFAULT false,
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(drawing_id, page_number, name, created_by)
);

CREATE INDEX idx_dml_drawing_page ON drawing_markup_layers(drawing_id, page_number);
CREATE INDEX idx_dml_tenant ON drawing_markup_layers(tenant_id);
