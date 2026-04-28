-- Migration 182: Create opportunity_scores table for Go/No-Go scoring
-- Stores scoring events for Gate 1 (Lead→Opportunity) and Gate 2 (Opportunity→Quoted)
-- Each row is one scoring event; latest per opportunity is the "current" score.

CREATE TABLE IF NOT EXISTS opportunity_scores (
  id SERIAL PRIMARY KEY,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Gate indicator: 1 = Lead→Opportunity, 2 = Opportunity→Quoted
  gate SMALLINT NOT NULL CHECK (gate IN (1, 2)),

  -- Factor scores (1-5 scale, NULL = TBD / not yet scored)
  -- Gate 1 factors (scored at both gates):
  customer_relationship SMALLINT CHECK (customer_relationship BETWEEN 1 AND 5),
  scope_fit             SMALLINT CHECK (scope_fit BETWEEN 1 AND 5),
  delivery_method       SMALLINT CHECK (delivery_method BETWEEN 1 AND 5),
  strategic_value       SMALLINT CHECK (strategic_value BETWEEN 1 AND 5),

  -- Gate 2 additional factors:
  schedule_fit          SMALLINT CHECK (schedule_fit BETWEEN 1 AND 5),
  margin_profile        SMALLINT CHECK (margin_profile BETWEEN 1 AND 5),
  win_probability_score SMALLINT CHECK (win_probability_score BETWEEN 1 AND 5),

  -- Computed totals (server-computed on save)
  total_score  INTEGER NOT NULL DEFAULT 0,
  max_possible INTEGER NOT NULL DEFAULT 0,

  -- 6 dealbreaker flags (any TRUE = automatic no-go unless overridden)
  db_payment_dispute    BOOLEAN NOT NULL DEFAULT false,
  db_liquidated_damages BOOLEAN NOT NULL DEFAULT false,
  db_schedule_conflict  BOOLEAN NOT NULL DEFAULT false,
  db_scope_outside      BOOLEAN NOT NULL DEFAULT false,
  db_margin_below_floor BOOLEAN NOT NULL DEFAULT false,
  db_bonding_unmet      BOOLEAN NOT NULL DEFAULT false,

  -- VP override
  has_override    BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  override_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Computed recommendation
  recommendation VARCHAR(20) CHECK (recommendation IN (
    'advance', 'review_required', 'no_go', 'go', 'vp_override'
  )),

  notes     TEXT,
  scored_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_opp_scores_opp ON opportunity_scores(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_scores_tenant ON opportunity_scores(tenant_id);

CREATE TRIGGER update_opportunity_scores_updated_at
  BEFORE UPDATE ON opportunity_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
