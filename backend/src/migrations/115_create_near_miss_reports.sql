-- Near Miss / Hazard Identification / Incentive reports
CREATE TABLE IF NOT EXISTS near_miss_reports (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  number INTEGER NOT NULL,
  report_type VARCHAR(50) NOT NULL DEFAULT 'near_miss',  -- near_miss, hazard_identification, incentive
  date_of_incident DATE NOT NULL,
  location_on_site TEXT,
  description TEXT NOT NULL,
  corrective_action TEXT,
  date_corrected DATE,
  reported_by TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, submitted
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_near_miss_reports_project ON near_miss_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_near_miss_reports_tenant ON near_miss_reports(tenant_id);
