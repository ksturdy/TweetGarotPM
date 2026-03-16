-- Migration 138: Extend takeoff_items with traceover-specific columns
-- Adds source tracking, traceover linking, and additional metadata fields

-- Source of the item: manual entry, traceover drawing, assembly placement, or AI analysis
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';

-- Link to the traceover run that generated this item
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS traceover_run_id INTEGER REFERENCES traceover_runs(id) ON DELETE SET NULL;

-- Link to the document and page where this item was traced
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS document_id INTEGER REFERENCES traceover_documents(id) ON DELETE SET NULL;
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS page_number INTEGER;

-- Extended item metadata
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS component_type VARCHAR(50);
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS label VARCHAR(255) DEFAULT '';
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS material VARCHAR(100) DEFAULT '';
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS pipe_material VARCHAR(100) DEFAULT '';
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS labor_hours DECIMAL(10,4) DEFAULT 0;
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS reducing_size VARCHAR(50);

-- AI analysis metadata
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS confidence DECIMAL(5,2);
ALTER TABLE takeoff_items ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- Indexes for traceover queries
CREATE INDEX IF NOT EXISTS idx_takeoff_items_source ON takeoff_items(source);
CREATE INDEX IF NOT EXISTS idx_takeoff_items_run ON takeoff_items(traceover_run_id);
CREATE INDEX IF NOT EXISTS idx_takeoff_items_document ON takeoff_items(document_id);
