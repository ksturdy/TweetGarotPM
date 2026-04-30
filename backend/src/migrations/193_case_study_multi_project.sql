-- Migration 193: Case Study Multi-Project Support
-- Adds junction table to allow case studies to reference multiple projects

CREATE TABLE IF NOT EXISTS case_study_projects (
    id SERIAL PRIMARY KEY,
    case_study_id INTEGER NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(case_study_id, project_id)
);

CREATE INDEX idx_case_study_projects_case_study ON case_study_projects(case_study_id);
CREATE INDEX idx_case_study_projects_project ON case_study_projects(project_id);
CREATE INDEX idx_case_study_projects_tenant ON case_study_projects(tenant_id);

-- Migrate existing single-project links into junction table
INSERT INTO case_study_projects (case_study_id, project_id, tenant_id)
SELECT id, project_id, tenant_id
FROM case_studies
WHERE project_id IS NOT NULL
ON CONFLICT (case_study_id, project_id) DO NOTHING;
