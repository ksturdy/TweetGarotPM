ALTER TABLE project_schedule_segments
ADD COLUMN IF NOT EXISTS contour_type VARCHAR(20) NOT NULL DEFAULT 'flat';
