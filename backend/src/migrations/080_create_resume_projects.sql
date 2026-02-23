-- Migration 080: Create Resume Projects Table
-- Links resumes to projects (database-linked or custom entries)

CREATE TABLE IF NOT EXISTS resume_projects (
  id SERIAL PRIMARY KEY,
  resume_id INTEGER NOT NULL REFERENCES employee_resumes(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Database project link (optional - for employees who ARE the PM)
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,

  -- Custom project fields (for manual entry or override)
  project_name VARCHAR(255) NOT NULL,
  project_role VARCHAR(255) NOT NULL, -- e.g., "Project Manager", "Lead Estimator"
  customer_name VARCHAR(255),
  project_value DECIMAL(15, 2),
  start_date DATE,
  end_date DATE,
  description TEXT,
  square_footage INTEGER,
  location VARCHAR(255),

  -- Display order
  display_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_resume_projects_resume ON resume_projects(resume_id);
CREATE INDEX IF NOT EXISTS idx_resume_projects_project ON resume_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_resume_projects_tenant ON resume_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resume_projects_display_order ON resume_projects(resume_id, display_order);

-- Comments
COMMENT ON TABLE resume_projects IS 'Project experience entries for employee resumes - can be linked to database projects or entered manually';
COMMENT ON COLUMN resume_projects.project_id IS 'Optional link to projects table - NULL if manually entered';
COMMENT ON COLUMN resume_projects.project_role IS 'Employee role on the project (Project Manager, Estimator, etc.)';
COMMENT ON COLUMN resume_projects.display_order IS 'Order for displaying projects on resume (0-based)';
