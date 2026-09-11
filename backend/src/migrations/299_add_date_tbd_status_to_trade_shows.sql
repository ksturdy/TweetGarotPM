-- Add 'date_tbd' as a valid status for trade shows.
-- Used for recurring events that are confirmed but not yet scheduled for next year.
ALTER TABLE trade_shows
  DROP CONSTRAINT trade_shows_status_check;

ALTER TABLE trade_shows
  ADD CONSTRAINT trade_shows_status_check
  CHECK (status IN ('upcoming', 'registered', 'in_progress', 'completed', 'cancelled', 'date_tbd'));
