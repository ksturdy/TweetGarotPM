CREATE TABLE drawing_markups (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id),
  layer_id    INTEGER NOT NULL REFERENCES drawing_markup_layers(id) ON DELETE CASCADE,
  drawing_id  INTEGER NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  tool_type   VARCHAR(50) NOT NULL,
  -- 'pencil' | 'rectangle' | 'circle' | 'arrow' | 'line' | 'revision_cloud'
  -- 'text' | 'callout' | 'stamp'
  geometry    JSONB NOT NULL,
  -- pencil/revision_cloud: { points: [x,y,...] }  (normalized 0-1 fractions of page dims)
  -- rectangle:  { x, y, width, height }
  -- circle:     { cx, cy, rx, ry }
  -- arrow/line: { x1, y1, x2, y2 }
  -- text:       { x, y, text, fontSize }
  -- callout:    { x, y, text, leaderX, leaderY }
  -- stamp:      { x, y, width, height, stampType }
  --   stampType: 'APPROVED' | 'FOR_CONSTRUCTION' | 'NOT_FOR_CONSTRUCTION' | 'REJECTED'
  style       JSONB NOT NULL DEFAULT '{}',
  -- { stroke, strokeWidth, fill, opacity, fontSize, fontFamily }
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dm_layer    ON drawing_markups(layer_id);
CREATE INDEX idx_dm_drawing  ON drawing_markups(drawing_id, page_number);
CREATE INDEX idx_dm_tenant   ON drawing_markups(tenant_id);
