-- Phase Code Scheduling Tables
-- Stores Vista phase code data and PM scheduling decisions

-- Add 'phase_codes' to the vp_import_batches file_type check constraint
ALTER TABLE vp_import_batches DROP CONSTRAINT IF EXISTS vp_import_batches_file_type_check;
ALTER TABLE vp_import_batches ADD CONSTRAINT vp_import_batches_file_type_check
  CHECK (file_type IN ('contracts', 'work_orders', 'employees', 'customers', 'vendors', 'phase_codes'));

-- Raw Vista phase code import data
CREATE TABLE IF NOT EXISTS vp_phase_codes (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    contract VARCHAR(50),
    job VARCHAR(50) NOT NULL,
    job_description VARCHAR(500),
    cost_type INTEGER NOT NULL,
    phase VARCHAR(50) NOT NULL,
    phase_description VARCHAR(500),
    est_hours NUMERIC(12,2) DEFAULT 0,
    est_cost NUMERIC(14,2) DEFAULT 0,
    jtd_hours NUMERIC(12,2) DEFAULT 0,
    jtd_cost NUMERIC(14,2) DEFAULT 0,
    committed_cost NUMERIC(14,2) DEFAULT 0,
    projected_cost NUMERIC(14,2) DEFAULT 0,
    percent_complete NUMERIC(8,4) DEFAULT 0,
    linked_project_id INTEGER REFERENCES projects(id),
    import_batch_id INTEGER REFERENCES vp_import_batches(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, job, cost_type, phase)
);

CREATE INDEX IF NOT EXISTS idx_vp_phase_codes_tenant ON vp_phase_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vp_phase_codes_project ON vp_phase_codes(linked_project_id);
CREATE INDEX IF NOT EXISTS idx_vp_phase_codes_job ON vp_phase_codes(job);

-- PM scheduling decisions for phase codes
CREATE TABLE IF NOT EXISTS phase_schedule_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id),
    name VARCHAR(500) NOT NULL,
    phase_code_ids INTEGER[] NOT NULL,
    cost_types INTEGER[] NOT NULL,
    start_date DATE,
    end_date DATE,
    contour_type VARCHAR(20) DEFAULT 'flat',
    use_manual_values BOOLEAN DEFAULT FALSE,
    manual_monthly_values JSONB,
    total_est_cost NUMERIC(14,2) DEFAULT 0,
    total_est_hours NUMERIC(12,2) DEFAULT 0,
    total_jtd_cost NUMERIC(14,2) DEFAULT 0,
    quantity NUMERIC(14,2),
    quantity_uom VARCHAR(10),
    quantity_installed NUMERIC(14,2) DEFAULT 0,
    use_manual_qty_values BOOLEAN DEFAULT FALSE,
    manual_monthly_qty JSONB,
    sort_order INTEGER DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_phase_schedule_project ON phase_schedule_items(project_id);
CREATE INDEX IF NOT EXISTS idx_phase_schedule_tenant ON phase_schedule_items(tenant_id);
