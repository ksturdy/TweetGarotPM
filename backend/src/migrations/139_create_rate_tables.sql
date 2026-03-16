-- Migration: Create Rate Tables system
-- Rate tables store imported productivity rate book data as reusable libraries.
-- Flow: Rate Tables → Pipe Specs → Piping Services → Project Systems

-- ═══════════════════════════════════════════════════════════
-- Rate Tables (tenant-scoped, one per imported rate book section)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rate_tables (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_rate_tables_tenant ON rate_tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rate_tables_category ON rate_tables(tenant_id, category);

DROP TRIGGER IF EXISTS update_rate_tables_updated_at ON rate_tables;
CREATE TRIGGER update_rate_tables_updated_at
  BEFORE UPDATE ON rate_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════
-- Rate Table Columns (one per fitting/item type column)
-- Rates stored as JSONB: { "0.5": 0.25, "1": 0.35, ... }
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rate_table_columns (
  id SERIAL PRIMARY KEY,
  rate_table_id INTEGER NOT NULL REFERENCES rate_tables(id) ON DELETE CASCADE,
  column_key VARCHAR(50) NOT NULL,
  column_label VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  rates JSONB NOT NULL DEFAULT '{}',
  UNIQUE(rate_table_id, column_key)
);

CREATE INDEX IF NOT EXISTS idx_rate_table_columns_table ON rate_table_columns(rate_table_id);

-- ═══════════════════════════════════════════════════════════
-- Pipe Spec Rate Sources (provenance tracking)
-- Records which rate table columns were used to populate a spec
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pipe_spec_rate_sources (
  id SERIAL PRIMARY KEY,
  pipe_spec_id INTEGER NOT NULL REFERENCES pipe_specs(id) ON DELETE CASCADE,
  rate_table_column_id INTEGER REFERENCES rate_table_columns(id) ON DELETE SET NULL,
  target_field VARCHAR(30) NOT NULL,
  target_key VARCHAR(50),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipe_spec_rate_sources_spec ON pipe_spec_rate_sources(pipe_spec_id);
