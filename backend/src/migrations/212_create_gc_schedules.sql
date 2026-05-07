-- Migration 212: GC schedules (uploaded versions + parsed activities)
-- Lets users upload GC project schedules (Excel/CSV/XER/MS Project XML/PDF),
-- parse them into a filterable table, flag mechanical-trade rows by keyword
-- rules, and diff between any two versions. The phase_code_activity_links
-- table is the future bridge from our internal phase-code schedule items
-- to GC Activity IDs (populated in a later phase).

CREATE TABLE IF NOT EXISTS gc_schedule_versions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  version_label VARCHAR(255),
  schedule_date DATE,
  source_filename VARCHAR(500),
  source_format VARCHAR(20) NOT NULL,
  notes TEXT,

  activity_count INTEGER NOT NULL DEFAULT 0,
  parse_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  parse_error TEXT,

  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gc_versions_project
  ON gc_schedule_versions(tenant_id, project_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS gc_schedule_activities (
  id BIGSERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES gc_schedule_versions(id) ON DELETE CASCADE,

  activity_id VARCHAR(100),
  activity_name TEXT NOT NULL,
  wbs_code VARCHAR(255),
  wbs_path TEXT,

  start_date DATE,
  finish_date DATE,
  baseline_start DATE,
  baseline_finish DATE,
  duration_days NUMERIC(10,2),
  percent_complete NUMERIC(5,2),
  status VARCHAR(50),

  predecessors TEXT,
  successors TEXT,
  responsible VARCHAR(255),

  trade VARCHAR(50),
  is_mechanical BOOLEAN NOT NULL DEFAULT FALSE,
  mechanical_override BOOLEAN NOT NULL DEFAULT FALSE,
  is_milestone BOOLEAN NOT NULL DEFAULT FALSE,
  is_summary BOOLEAN NOT NULL DEFAULT FALSE,

  raw JSONB,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_gc_activities_version
  ON gc_schedule_activities(version_id, display_order);
CREATE INDEX IF NOT EXISTS idx_gc_activities_activity_id
  ON gc_schedule_activities(version_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_gc_activities_mech
  ON gc_schedule_activities(version_id) WHERE is_mechanical = TRUE;

-- Editable keyword rules for trade classification. Rows with tenant_id NULL
-- are global defaults; tenant-specific rows override/add to them.
CREATE TABLE IF NOT EXISTS gc_schedule_trade_rules (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id),
  trade VARCHAR(50) NOT NULL,
  keyword VARCHAR(100) NOT NULL,
  match_field VARCHAR(20) NOT NULL DEFAULT 'all',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gc_trade_rules
  ON gc_schedule_trade_rules(tenant_id, trade) WHERE is_active = TRUE;

INSERT INTO gc_schedule_trade_rules (tenant_id, trade, keyword, match_field) VALUES
  (NULL, 'mechanical', 'MECH',          'all'),
  (NULL, 'mechanical', 'HVAC',          'all'),
  (NULL, 'mechanical', 'PIPING',        'all'),
  (NULL, 'mechanical', 'PIPE',          'all'),
  (NULL, 'mechanical', 'DUCT',          'all'),
  (NULL, 'mechanical', 'DUCTWORK',      'all'),
  (NULL, 'mechanical', 'PLUMB',         'all'),
  (NULL, 'mechanical', 'PLBG',          'all'),
  (NULL, 'mechanical', 'CHILLER',       'all'),
  (NULL, 'mechanical', 'BOILER',        'all'),
  (NULL, 'mechanical', 'AHU',           'all'),
  (NULL, 'mechanical', 'RTU',           'all'),
  (NULL, 'mechanical', 'VAV',           'all'),
  (NULL, 'mechanical', 'HYDRONIC',      'all'),
  (NULL, 'mechanical', 'REFRIG',        'all'),
  (NULL, 'mechanical', 'TWEET GAROT',   'responsible'),
  (NULL, 'mechanical', 'TWEET-GAROT',   'responsible'),
  (NULL, 'electrical', 'ELEC',          'all'),
  (NULL, 'electrical', 'ELECTRICAL',    'all'),
  (NULL, 'plumbing',   'PLUMB',         'all'),
  (NULL, 'sprinkler',  'SPRINKLER',     'all'),
  (NULL, 'sprinkler',  'FIRE PROTECT',  'all'),
  (NULL, 'controls',   'CONTROLS',      'all'),
  (NULL, 'controls',   'BAS',           'all'),
  (NULL, 'controls',   'BMS',           'all');

-- Future: link our internal phase-code schedule items to GC Activity IDs.
-- We key on activity_id (text) rather than the activity row id so the link
-- survives across new uploaded versions.
CREATE TABLE IF NOT EXISTS phase_code_activity_links (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  schedule_item_id INTEGER REFERENCES schedule_items(id) ON DELETE CASCADE,
  gc_activity_id VARCHAR(100) NOT NULL,
  link_type VARCHAR(20) NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, schedule_item_id, gc_activity_id)
);

CREATE INDEX IF NOT EXISTS idx_phase_code_links_project
  ON phase_code_activity_links(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_phase_code_links_activity
  ON phase_code_activity_links(project_id, gc_activity_id);
