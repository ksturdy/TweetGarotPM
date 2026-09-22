CREATE TABLE IF NOT EXISTS opportunity_reminders (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opportunity_id  INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remind_at       TIMESTAMPTZ NOT NULL,
  note            TEXT,
  recurrence_days INTEGER,        -- NULL = one-shot; 7/14/30/90/180 for repeating
  fired_at        TIMESTAMPTZ,    -- NULL = pending; set when notification fires
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_reminders_pending
  ON opportunity_reminders (remind_at)
  WHERE fired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_reminders_opportunity
  ON opportunity_reminders (opportunity_id);
