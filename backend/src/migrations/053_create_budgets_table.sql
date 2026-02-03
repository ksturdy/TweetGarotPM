-- Create budgets table for saving AI-generated budgets
CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    project_name VARCHAR(255) NOT NULL,
    building_type VARCHAR(100),
    project_type VARCHAR(100),
    bid_type VARCHAR(100),
    square_footage DECIMAL(12, 2),
    scope_notes TEXT,

    -- Summary fields
    estimated_total DECIMAL(14, 2),
    cost_per_sqft DECIMAL(10, 2),
    confidence_level VARCHAR(20), -- 'high', 'medium', 'low'
    methodology TEXT,

    -- Totals breakdown
    labor_subtotal DECIMAL(14, 2) DEFAULT 0,
    material_subtotal DECIMAL(14, 2) DEFAULT 0,
    equipment_subtotal DECIMAL(14, 2) DEFAULT 0,
    subcontract_subtotal DECIMAL(14, 2) DEFAULT 0,
    direct_cost_subtotal DECIMAL(14, 2) DEFAULT 0,
    overhead DECIMAL(14, 2) DEFAULT 0,
    profit DECIMAL(14, 2) DEFAULT 0,
    contingency DECIMAL(14, 2) DEFAULT 0,
    grand_total DECIMAL(14, 2) DEFAULT 0,

    -- Markup percentages (for recalculation)
    overhead_percent DECIMAL(5, 2) DEFAULT 10,
    profit_percent DECIMAL(5, 2) DEFAULT 10,
    contingency_percent DECIMAL(5, 2) DEFAULT 5,

    -- JSON data for complex structures
    sections JSONB, -- Array of sections with items
    assumptions JSONB, -- Array of assumption strings
    risks JSONB, -- Array of risk strings
    comparable_projects JSONB, -- Array of comparable project data

    -- Status and tracking
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'final', 'archived'
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_budgets_tenant ON budgets(tenant_id);
CREATE INDEX idx_budgets_status ON budgets(status);
CREATE INDEX idx_budgets_created_by ON budgets(created_by);
CREATE INDEX idx_budgets_building_type ON budgets(building_type);
CREATE INDEX idx_budgets_project_type ON budgets(project_type);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW
    EXECUTE FUNCTION update_budgets_updated_at();
