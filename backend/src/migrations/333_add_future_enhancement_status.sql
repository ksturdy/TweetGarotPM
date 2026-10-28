-- Add 'future_enhancement' status to feedback table
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'feedback'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%on_hold%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE feedback DROP CONSTRAINT ' || quote_ident(v_constraint);
  END IF;
END $$;

ALTER TABLE feedback
  ADD CONSTRAINT feedback_status_check
  CHECK (status IN ('submitted', 'read', 'under_review', 'in_progress', 'in_testing', 'completed', 'on_hold', 'rejected', 'future_enhancement'));
