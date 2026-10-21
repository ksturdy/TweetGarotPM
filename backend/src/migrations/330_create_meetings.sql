-- Meeting series (recurring meeting templates)
CREATE TABLE IF NOT EXISTS meeting_series (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  meeting_type VARCHAR(100) NOT NULL DEFAULT 'project_meeting',
  recurrence_type VARCHAR(50) NOT NULL DEFAULT 'weekly', -- weekly, biweekly, monthly
  day_of_week INTEGER, -- 0=Sun, 1=Mon ... 6=Sat (null for monthly)
  start_time TIME,
  end_time TIME,
  location VARCHAR(255),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_series_project ON meeting_series(project_id);
CREATE INDEX IF NOT EXISTS idx_meeting_series_tenant ON meeting_series(tenant_id);

-- Individual meeting instances (one-off or belonging to a series)
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  series_id INTEGER REFERENCES meeting_series(id) ON DELETE SET NULL,
  previous_meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
  number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  meeting_type VARCHAR(100) NOT NULL DEFAULT 'project_meeting',
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, published, closed
  scheduled_date DATE,
  start_time TIME,
  end_time TIME,
  location VARCHAR(255),
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  published_at TIMESTAMP,
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, number)
);

CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_series ON meetings(series_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_tenant ON meetings(tenant_id);

-- Attendees (internal users or external contacts)
CREATE TABLE IF NOT EXISTS meeting_attendees (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  name VARCHAR(255),
  company VARCHAR(255),
  attended BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting ON meeting_attendees(meeting_id);

-- Agenda items (ordered list of topics)
CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  title VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_agenda_items_meeting ON meeting_agenda_items(meeting_id);

-- Action items (tasks that can carry forward across meetings)
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id INTEGER REFERENCES meeting_agenda_items(id) ON DELETE SET NULL,
  originated_meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assignee_name VARCHAR(255),
  due_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, in_progress, closed
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting ON meeting_action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_status ON meeting_action_items(status);
