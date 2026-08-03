-- Cost Control Matrix: tracks budget evolution through design milestones
-- Each matrix has versioned columns (one per design phase) and row data per line item

CREATE TABLE IF NOT EXISTS cost_control_matrices (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    budget_id INTEGER REFERENCES budgets(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    target_cost DECIMAL(16, 2),
    fee_pct DECIMAL(6, 4) DEFAULT 0.05,
    overhead_pct DECIMAL(6, 4) DEFAULT 0.10,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One row per design milestone / budget iteration (becomes a column group in the UI)
CREATE TABLE IF NOT EXISTS cost_control_versions (
    id SERIAL PRIMARY KEY,
    matrix_id INTEGER NOT NULL REFERENCES cost_control_matrices(id) ON DELETE CASCADE,
    version_name VARCHAR(255) NOT NULL,
    version_date DATE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_execution_phase BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Work areas / systems (e.g. "Ductwork - Supply Air", "Piping - Chilled Water")
CREATE TABLE IF NOT EXISTS cost_control_areas (
    id SERIAL PRIMARY KEY,
    matrix_id INTEGER NOT NULL REFERENCES cost_control_matrices(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Line items (the rows): one per cost type per area
CREATE TABLE IF NOT EXISTS cost_control_line_items (
    id SERIAL PRIMARY KEY,
    matrix_id INTEGER NOT NULL REFERENCES cost_control_matrices(id) ON DELETE CASCADE,
    area_id INTEGER REFERENCES cost_control_areas(id) ON DELETE SET NULL,
    cost_type VARCHAR(50) NOT NULL CHECK (cost_type IN (
        'labor_field', 'labor_shop', 'material', 'equipment', 'subcontract', 'gen_conditions'
    )),
    description VARCHAR(255) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Actual data: one row per (line_item × version)
CREATE TABLE IF NOT EXISTS cost_control_version_values (
    id SERIAL PRIMARY KEY,
    line_item_id INTEGER NOT NULL REFERENCES cost_control_line_items(id) ON DELETE CASCADE,
    version_id INTEGER NOT NULL REFERENCES cost_control_versions(id) ON DELETE CASCADE,
    qty DECIMAL(16, 4),
    value DECIMAL(16, 2),
    notes TEXT,
    -- Execution-phase columns (populated only when version.is_execution_phase = true)
    actual_cost DECIMAL(16, 2),
    pct_complete DECIMAL(5, 2),
    UNIQUE (line_item_id, version_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ccm_tenant ON cost_control_matrices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccm_budget ON cost_control_matrices(budget_id);
CREATE INDEX IF NOT EXISTS idx_ccm_project ON cost_control_matrices(project_id);
CREATE INDEX IF NOT EXISTS idx_ccv_matrix ON cost_control_versions(matrix_id);
CREATE INDEX IF NOT EXISTS idx_cca_matrix ON cost_control_areas(matrix_id);
CREATE INDEX IF NOT EXISTS idx_ccli_matrix ON cost_control_line_items(matrix_id);
CREATE INDEX IF NOT EXISTS idx_ccli_area ON cost_control_line_items(area_id);
CREATE INDEX IF NOT EXISTS idx_ccvv_item ON cost_control_version_values(line_item_id);
CREATE INDEX IF NOT EXISTS idx_ccvv_version ON cost_control_version_values(version_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_ccm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ccm_updated_at
    BEFORE UPDATE ON cost_control_matrices
    FOR EACH ROW
    EXECUTE FUNCTION update_ccm_updated_at();
