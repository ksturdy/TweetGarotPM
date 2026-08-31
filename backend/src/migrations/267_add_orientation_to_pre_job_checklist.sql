-- Migration 267: Add orientation section to pre_job_checklist
-- Covers site security (badge, orientation, safety training), directions,
-- site map attachment, and orientation contact/link.

ALTER TABLE pre_job_checklist
  ADD COLUMN IF NOT EXISTS orientation JSONB NOT NULL DEFAULT '{}';
