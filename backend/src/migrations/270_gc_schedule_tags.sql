-- Project-level tags for GC schedule activities.
-- Tags are keyed by activity_id (the string schedule ID) so they survive
-- re-uploads of the same schedule.

CREATE TABLE gc_schedule_tags (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id),
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  color       VARCHAR(7)   NOT NULL DEFAULT '#6366f1',
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT gc_schedule_tags_name_unique UNIQUE (tenant_id, project_id, name)
);

-- Many-to-many: tags <-> activity_ids (string key, not row id)
CREATE TABLE gc_activity_tag_assignments (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER      NOT NULL REFERENCES tenants(id),
  tag_id      INTEGER      NOT NULL REFERENCES gc_schedule_tags(id) ON DELETE CASCADE,
  activity_id VARCHAR(255) NOT NULL,
  project_id  INTEGER      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT gc_activity_tag_assignments_unique UNIQUE (tag_id, activity_id)
);

CREATE INDEX gc_activity_tag_assignments_lookup_idx
  ON gc_activity_tag_assignments(project_id, activity_id);
