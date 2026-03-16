-- Migration 137: Create traceover data model tables
-- Phase 3 of Titan Takeoff integration

-- ─── Traceover Documents ───
-- Uploaded PDF files for traceover takeoffs
CREATE TABLE IF NOT EXISTS traceover_documents (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    takeoff_id INTEGER NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    file_size INTEGER DEFAULT 0,
    page_count INTEGER DEFAULT 0,
    uploaded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_traceover_documents_takeoff ON traceover_documents(takeoff_id);
CREATE INDEX idx_traceover_documents_tenant ON traceover_documents(tenant_id);

-- ─── Page Metadata ───
-- Per-page metadata (sheet name, drawing number, level, area)
CREATE TABLE IF NOT EXISTS traceover_page_metadata (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES traceover_documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    name VARCHAR(255) DEFAULT '',
    drawing_number VARCHAR(100) DEFAULT '',
    level VARCHAR(100) DEFAULT '',
    area VARCHAR(100) DEFAULT '',
    revision VARCHAR(50) DEFAULT '',
    UNIQUE(document_id, page_number)
);

CREATE INDEX idx_traceover_page_metadata_doc ON traceover_page_metadata(document_id);

-- ─── Calibrations ───
-- Scale calibration per document page (pixels → real-world units)
CREATE TABLE IF NOT EXISTS traceover_calibrations (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES traceover_documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    start_point JSONB NOT NULL,
    end_point JSONB NOT NULL,
    pixel_distance DECIMAL(12,4) NOT NULL,
    real_distance DECIMAL(12,4) NOT NULL,
    unit VARCHAR(10) NOT NULL DEFAULT 'ft',
    pixels_per_unit DECIMAL(12,6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, page_number)
);

CREATE INDEX idx_traceover_calibrations_doc ON traceover_calibrations(document_id);

-- ─── Traceover Runs ───
-- Completed pipe trace runs with segments and branches stored as JSONB
CREATE TABLE IF NOT EXISTS traceover_runs (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    takeoff_id INTEGER NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
    document_id INTEGER REFERENCES traceover_documents(id) ON DELETE SET NULL,
    page_number INTEGER,
    config JSONB NOT NULL DEFAULT '{}',
    segments JSONB NOT NULL DEFAULT '[]',
    branches JSONB NOT NULL DEFAULT '[]',
    is_complete BOOLEAN DEFAULT false,
    total_pixel_length DECIMAL(12,4) DEFAULT 0,
    total_scaled_length DECIMAL(12,4) DEFAULT 0,
    vertical_pipe_length DECIMAL(12,4) DEFAULT 0,
    fitting_counts JSONB DEFAULT '{}',
    generated_takeoff_item_ids INTEGER[] DEFAULT '{}',
    branch_parent_pipe_size JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_traceover_runs_takeoff ON traceover_runs(takeoff_id);
CREATE INDEX idx_traceover_runs_document ON traceover_runs(document_id);
CREATE INDEX idx_traceover_runs_tenant ON traceover_runs(tenant_id);

-- ─── Measurements ───
-- Linear, area, and count measurements on PDF pages
CREATE TABLE IF NOT EXISTS traceover_measurements (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES traceover_documents(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL,
    measurement_type VARCHAR(20) NOT NULL DEFAULT 'linear',
    points JSONB NOT NULL DEFAULT '[]',
    label VARCHAR(255) DEFAULT '',
    color VARCHAR(20) DEFAULT '#3b82f6',
    pixel_value DECIMAL(12,4) DEFAULT 0,
    scaled_value DECIMAL(12,4) DEFAULT 0,
    unit VARCHAR(20) DEFAULT 'ft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_traceover_measurements_doc ON traceover_measurements(document_id);
CREATE INDEX idx_traceover_measurements_doc_page ON traceover_measurements(document_id, page_number);

-- ─── Assembly Templates ───
-- Reusable piping assembly definitions (tenant-scoped)
CREATE TABLE IF NOT EXISTS assembly_templates (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    category VARCHAR(100) DEFAULT '',
    bounding_box JSONB DEFAULT '{"width": 200, "height": 200}',
    runs JSONB DEFAULT '[]',
    placed_items JSONB DEFAULT '[]',
    connection_points JSONB DEFAULT '[]',
    thumbnail_data_url TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assembly_templates_tenant ON assembly_templates(tenant_id);
CREATE INDEX idx_assembly_templates_category ON assembly_templates(tenant_id, category);

-- ─── Assembly Instances ───
-- Placed assembly instances on traceover pages
CREATE TABLE IF NOT EXISTS assembly_instances (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    takeoff_id INTEGER NOT NULL REFERENCES takeoffs(id) ON DELETE CASCADE,
    assembly_template_id INTEGER NOT NULL REFERENCES assembly_templates(id),
    assembly_name VARCHAR(255) DEFAULT '',
    origin JSONB NOT NULL DEFAULT '{"x": 0, "y": 0}',
    document_id INTEGER REFERENCES traceover_documents(id) ON DELETE SET NULL,
    page_number INTEGER,
    run_ids INTEGER[] DEFAULT '{}',
    item_ids INTEGER[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assembly_instances_takeoff ON assembly_instances(takeoff_id);
CREATE INDEX idx_assembly_instances_template ON assembly_instances(assembly_template_id);

-- ─── Triggers for updated_at ───
CREATE TRIGGER set_traceover_documents_updated_at
    BEFORE UPDATE ON traceover_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_traceover_runs_updated_at
    BEFORE UPDATE ON traceover_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_assembly_templates_updated_at
    BEFORE UPDATE ON assembly_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_assembly_instances_updated_at
    BEFORE UPDATE ON assembly_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
