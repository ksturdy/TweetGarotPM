-- Migration: Create vendors table for Account Management
-- Description: Vendors/Subcontractors database for Accounts Payable
-- Note: Customers table already exists from previous migration

-- Vendors/Subcontractors Table (Accounts Payable)
CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  vendor_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'USA',

  -- Financial fields
  payment_terms VARCHAR(100), -- e.g., "Net 30", "Net 60", "2/10 Net 30"
  tax_id VARCHAR(50), -- EIN
  w9_on_file BOOLEAN DEFAULT FALSE,

  -- Vendor classification
  vendor_type VARCHAR(50), -- subcontractor, supplier, service_provider
  trade_specialty VARCHAR(100), -- HVAC, Electrical, Plumbing, etc.

  -- Insurance and compliance
  insurance_expiry DATE,
  license_number VARCHAR(100),
  license_expiry DATE,

  -- Contact information
  primary_contact VARCHAR(255),
  accounts_payable_contact VARCHAR(255),
  accounts_payable_email VARCHAR(255),

  -- Performance tracking
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating
  status VARCHAR(50) DEFAULT 'active', -- active, inactive, suspended
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_type ON vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendors_trade_specialty ON vendors(trade_specialty);
CREATE INDEX IF NOT EXISTS idx_vendors_email ON vendors(email);
CREATE INDEX IF NOT EXISTS idx_vendors_created_at ON vendors(created_at);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_vendors_updated_at ON vendors;
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
