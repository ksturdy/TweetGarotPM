-- Project Companies and Contacts
-- Migration for managing project stakeholders (GC, Owner, Architect, Engineer, etc.)

-- Companies table (stores all companies associated with projects)
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project Companies junction table (links companies to projects with roles)
CREATE TABLE IF NOT EXISTS project_companies (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('general_contractor', 'owner', 'architect', 'engineer', 'subcontractor', 'other')),
    is_primary BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, company_id, role)
);

-- Contacts table (stores individual contacts within companies)
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    title VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    is_primary BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add recipient fields to RFIs table
ALTER TABLE rfis
ADD COLUMN IF NOT EXISTS recipient_company_id INTEGER REFERENCES companies(id),
ADD COLUMN IF NOT EXISTS recipient_contact_id INTEGER REFERENCES contacts(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_companies_project ON project_companies(project_id);
CREATE INDEX IF NOT EXISTS idx_project_companies_company ON project_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_project_companies_role ON project_companies(role);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_rfis_recipient_company ON rfis(recipient_company_id);
CREATE INDEX IF NOT EXISTS idx_rfis_recipient_contact ON rfis(recipient_contact_id);
