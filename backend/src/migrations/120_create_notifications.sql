-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,  -- 'rfi', 'field_issue', 'daily_report'
  entity_id INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,   -- 'created', 'submitted', 'status_changed'
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(500),                 -- Frontend route to navigate to
  read_at TIMESTAMP,
  email_sent BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX idx_notifications_read_at ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
