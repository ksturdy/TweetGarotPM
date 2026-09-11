-- Tag groups for GC schedule tags.
-- Users can create up to 3 named groups per project (enforced in the API),
-- and assign individual tags to those groups. Deleting a group sets its
-- tags' group_id to NULL (ungrouped) rather than deleting the tags.

CREATE TABLE gc_schedule_tag_groups (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id),
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gc_schedule_tag_groups_name_unique UNIQUE (tenant_id, project_id, name)
);

ALTER TABLE gc_schedule_tags
  ADD COLUMN group_id INTEGER REFERENCES gc_schedule_tag_groups(id) ON DELETE SET NULL;

CREATE INDEX gc_schedule_tags_group_idx ON gc_schedule_tags(group_id);
