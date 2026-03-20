-- Add labor rate per hour to takeoffs for labor cost calculation in reports
ALTER TABLE takeoffs
  ADD COLUMN IF NOT EXISTS labor_rate_per_hour DECIMAL(10,2) DEFAULT 0;
