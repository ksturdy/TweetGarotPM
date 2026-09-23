CREATE TABLE IF NOT EXISTS opportunity_history (
  id               SERIAL PRIMARY KEY,
  opportunity_id   INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  tenant_id        INTEGER NOT NULL,
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type       VARCHAR(20) NOT NULL, -- 'created' | 'updated'
  summary          TEXT NOT NULL,
  changes          JSONB DEFAULT '[]',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_opp_history_opportunity_id ON opportunity_history(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_history_tenant_id ON opportunity_history(tenant_id);
