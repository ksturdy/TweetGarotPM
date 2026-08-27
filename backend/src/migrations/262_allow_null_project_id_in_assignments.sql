-- Labor account assignments have no project; project_id must be nullable.
ALTER TABLE project_assignments ALTER COLUMN project_id DROP NOT NULL;
