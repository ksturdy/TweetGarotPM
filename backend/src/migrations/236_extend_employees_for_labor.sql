-- Migration 236: Extend employees for Labor / Resource Management module
-- Adds craft-labor-specific fields. NULL today; will be populated when the
-- Vista TGPREmployees import is extended to map Trade / Group / Title.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS trade VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_group VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS title VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_type VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_employees_trade ON employees(trade);
CREATE INDEX IF NOT EXISTS idx_employees_group ON employees(employee_group);
CREATE INDEX IF NOT EXISTS idx_employees_title ON employees(title);
