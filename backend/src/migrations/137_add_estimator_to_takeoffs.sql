-- Add estimator_id to takeoffs to track which user is performing the takeoff
ALTER TABLE takeoffs
  ADD COLUMN estimator_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Backfill: set estimator to created_by for existing takeoffs
UPDATE takeoffs SET estimator_id = created_by WHERE estimator_id IS NULL;
