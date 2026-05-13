-- Migration 216: Add opportunity_links table for posting project information hyperlinks

CREATE TABLE IF NOT EXISTS opportunity_links (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    url TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_opportunity_links_opportunity_id ON opportunity_links(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_links_tenant_id ON opportunity_links(tenant_id);

-- Reuse existing update_updated_at_column() trigger function
DROP TRIGGER IF EXISTS trigger_opportunity_links_updated_at ON opportunity_links;
CREATE TRIGGER trigger_opportunity_links_updated_at
    BEFORE UPDATE ON opportunity_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
