-- Add favorite column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS favorite BOOLEAN DEFAULT false;

-- Create index for faster sorting by favorites
CREATE INDEX IF NOT EXISTS idx_customers_favorite ON customers(favorite);
