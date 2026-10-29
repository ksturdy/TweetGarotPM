-- Add name column to submittals
ALTER TABLE submittals ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Drop old check constraint FIRST so updates aren't blocked
ALTER TABLE submittals DROP CONSTRAINT IF EXISTS submittals_status_check;

-- Migrate existing status values to new workflow
UPDATE submittals SET status = 'requested_from_vendor' WHERE status = 'pending';
UPDATE submittals SET status = 'submitted_for_approval' WHERE status = 'under_review';
UPDATE submittals SET status = 'approved' WHERE status = 'approved_as_noted';
UPDATE submittals SET status = 'revise_resubmit' WHERE status = 'rejected';

-- Add new check constraint
ALTER TABLE submittals ADD CONSTRAINT submittals_status_check
  CHECK (status IN ('requested_from_vendor', 'submitted_for_approval', 'revise_resubmit', 'approved'));

-- Update default status
ALTER TABLE submittals ALTER COLUMN status SET DEFAULT 'requested_from_vendor';
