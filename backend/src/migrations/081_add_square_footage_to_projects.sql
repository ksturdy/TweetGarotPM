-- Migration 081: Add square_footage to projects table
-- This field tracks the project's building square footage for case studies and reporting

ALTER TABLE projects ADD COLUMN IF NOT EXISTS square_footage INTEGER;
