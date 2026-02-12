-- Migration 076: Case Studies Module
-- Creates tables for case studies and case study images

-- Case Studies table
CREATE TABLE IF NOT EXISTS case_studies (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,

    -- Core fields
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,

    -- Content sections (structured for templating)
    challenge TEXT,
    solution TEXT,
    results TEXT,
    executive_summary TEXT,

    -- Metrics/outcomes
    cost_savings DECIMAL(12,2),
    timeline_improvement_days INTEGER,
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    additional_metrics JSONB,

    -- Categorization
    market VARCHAR(100),
    construction_type VARCHAR(100),
    project_size VARCHAR(50),
    services_provided TEXT[],

    -- Status workflow
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'published', 'archived')),
    featured BOOLEAN DEFAULT false,
    display_order INTEGER,

    -- Metadata
    created_by INTEGER REFERENCES users(id),
    reviewed_by INTEGER REFERENCES users(id),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Case Study Images table
CREATE TABLE IF NOT EXISTS case_study_images (
    id SERIAL PRIMARY KEY,
    case_study_id INTEGER NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,

    -- File metadata (embedded approach)
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(50),

    -- Image details
    caption TEXT,
    display_order INTEGER NOT NULL,
    is_hero_image BOOLEAN DEFAULT false,
    is_before_photo BOOLEAN DEFAULT false,
    is_after_photo BOOLEAN DEFAULT false,

    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for case_studies
CREATE INDEX idx_case_studies_tenant ON case_studies(tenant_id);
CREATE INDEX idx_case_studies_status ON case_studies(status);
CREATE INDEX idx_case_studies_featured ON case_studies(featured);
CREATE INDEX idx_case_studies_project ON case_studies(project_id);
CREATE INDEX idx_case_studies_customer ON case_studies(customer_id);
CREATE INDEX idx_case_studies_market ON case_studies(market);

-- Indexes for case_study_images
CREATE INDEX idx_case_study_images_case_study ON case_study_images(case_study_id);
CREATE INDEX idx_case_study_images_display_order ON case_study_images(case_study_id, display_order);
