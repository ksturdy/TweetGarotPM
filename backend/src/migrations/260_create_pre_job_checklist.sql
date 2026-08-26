-- Migration 260: Create pre_job_checklist table for per-project pre-construction planning

CREATE TABLE IF NOT EXISTS pre_job_checklist (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_info JSONB NOT NULL DEFAULT '{}',
  labor JSONB NOT NULL DEFAULT '{}',
  material JSONB NOT NULL DEFAULT '{}',
  subcontracts JSONB NOT NULL DEFAULT '{}',
  rental JSONB NOT NULL DEFAULT '{}',
  mep_equipment JSONB NOT NULL DEFAULT '{}',
  general_conditions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_pre_job_checklist_project ON pre_job_checklist(project_id);
CREATE INDEX IF NOT EXISTS idx_pre_job_checklist_tenant ON pre_job_checklist(tenant_id);
