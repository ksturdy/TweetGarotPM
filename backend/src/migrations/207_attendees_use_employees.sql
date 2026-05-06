-- Migration 207: Trade show attendees should reference employees, not users.
-- Employees carry the richer profile data (job title, department, phone) that
-- matters for trade show prep. We add employee_id alongside user_id, backfill
-- from existing rows, then make employee_id the new primary identifier.
--
-- The legacy user_id column is kept (data preserved) but will no longer be
-- written to. The CHECK constraint is relaxed so going forward only
-- employee_id OR external_name is required.

ALTER TABLE trade_show_attendees
  ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;

-- Backfill: link to the matching employee row when one exists.
UPDATE trade_show_attendees a
   SET employee_id = e.id
  FROM employees e
 WHERE a.user_id = e.user_id
   AND a.employee_id IS NULL;

-- Any rows whose user_id had no employee record become "external" attendees
-- so we don't lose them. Copy the user's name/email into the external_*
-- fields, then null the orphaned user_id.
UPDATE trade_show_attendees a
   SET external_name = COALESCE(a.external_name, u.first_name || ' ' || u.last_name),
       external_email = COALESCE(a.external_email, u.email)
  FROM users u
 WHERE a.user_id = u.id
   AND a.employee_id IS NULL
   AND a.external_name IS NULL;

-- Drop the old check that required user_id OR external_name; replace with one
-- requiring employee_id OR external_name.
ALTER TABLE trade_show_attendees
  DROP CONSTRAINT IF EXISTS chk_attendee_identity;

ALTER TABLE trade_show_attendees
  ADD CONSTRAINT chk_attendee_identity
    CHECK (employee_id IS NOT NULL OR external_name IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_tsa_employee ON trade_show_attendees(employee_id);
