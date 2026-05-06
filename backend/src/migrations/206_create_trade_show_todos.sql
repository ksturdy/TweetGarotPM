-- Migration 206: Create trade_show_todos table
-- Time-sensitive task list per trade show. Supports assignment to a user,
-- a due date/time, priority, and a reminder offset that drives in-app +
-- email notifications via the existing notificationService.

CREATE TABLE IF NOT EXISTS trade_show_todos (
  id SERIAL PRIMARY KEY,
  trade_show_id INTEGER NOT NULL REFERENCES trade_shows(id) ON DELETE CASCADE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),

  title VARCHAR(255) NOT NULL,
  description TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  due_date DATE,
  due_time TIME,

  -- Minutes before due_date/due_time when a reminder should fire.
  -- NULL means no reminder.
  reminder_offset_minutes INTEGER,
  reminder_sent_at TIMESTAMPTZ,

  assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tst_show ON trade_show_todos(trade_show_id);
CREATE INDEX IF NOT EXISTS idx_tst_tenant ON trade_show_todos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tst_assignee ON trade_show_todos(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tst_status_due ON trade_show_todos(status, due_date);
-- Partial index optimized for the reminder cron query: pending reminders only.
CREATE INDEX IF NOT EXISTS idx_tst_pending_reminder
  ON trade_show_todos(due_date, due_time)
  WHERE reminder_sent_at IS NULL
    AND reminder_offset_minutes IS NOT NULL
    AND status <> 'done';
