CREATE TABLE item_comments (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id),
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  entity_type  VARCHAR(50)  NOT NULL,
  entity_key   VARCHAR(200) NOT NULL,
  comment      TEXT NOT NULL,
  link         VARCHAR(500),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ON item_comments (tenant_id, project_id, entity_type, entity_key);
CREATE INDEX ON item_comments (tenant_id, project_id, entity_type);
