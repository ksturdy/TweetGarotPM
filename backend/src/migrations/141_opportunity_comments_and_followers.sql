-- Migration 141: Add opportunity comments and followers tables
-- Enables commenting on opportunities and follow/notification on stage changes

-- Comments table (follows feedback_comments pattern)
CREATE TABLE IF NOT EXISTS opportunity_comments (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_opp_comments_opportunity_id ON opportunity_comments(opportunity_id);
CREATE INDEX idx_opp_comments_tenant_id ON opportunity_comments(tenant_id);

-- Reuse existing update_updated_at_column() trigger from migration 018
DROP TRIGGER IF EXISTS trigger_opp_comments_updated_at ON opportunity_comments;
CREATE TRIGGER trigger_opp_comments_updated_at
    BEFORE UPDATE ON opportunity_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Followers table (user follows opportunity to get notifications)
CREATE TABLE IF NOT EXISTS opportunity_followers (
    id SERIAL PRIMARY KEY,
    opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(opportunity_id, user_id)
);

CREATE INDEX idx_opp_followers_opportunity_id ON opportunity_followers(opportunity_id);
CREATE INDEX idx_opp_followers_user_id ON opportunity_followers(user_id);
