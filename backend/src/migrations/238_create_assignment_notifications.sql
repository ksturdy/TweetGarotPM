-- Migration 238: Notification log for labor assignment messages (email + SMS)

CREATE TABLE IF NOT EXISTS assignment_notifications (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES project_assignments(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL,
  channel VARCHAR(10) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body TEXT,
  status VARCHAR(20) DEFAULT 'sent',
  error TEXT,
  sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignment_notifications_assignment
  ON assignment_notifications(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_notifications_tenant
  ON assignment_notifications(tenant_id, sent_at DESC);
