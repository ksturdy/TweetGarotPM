-- Migration: Add tenant_id to contract review tables
-- Fix: column "tenant_id" of relation "contract_reviews" does not exist

ALTER TABLE contract_reviews ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE contract_risk_findings ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE contract_review_settings ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS idx_contract_reviews_tenant ON contract_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contract_risk_findings_tenant ON contract_risk_findings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contract_review_settings_tenant ON contract_review_settings(tenant_id);
