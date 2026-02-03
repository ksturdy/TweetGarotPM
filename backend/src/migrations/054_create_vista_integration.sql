-- Vista ERP Data Integration Tables
-- Stores imported data from Vista (Viewpoint) ERP system

-- Import batches table (track each import)
CREATE TABLE IF NOT EXISTS vp_import_batches (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  file_type VARCHAR(20) CHECK (file_type IN ('contracts', 'work_orders')),
  records_total INTEGER DEFAULT 0,
  records_new INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_auto_matched INTEGER DEFAULT 0,
  imported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VP Contracts table (from TGPBI_PMContractStatus)
CREATE TABLE IF NOT EXISTS vp_contracts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Vista ERP core fields
  contract_number VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(50),
  employee_number VARCHAR(10),
  project_manager_name VARCHAR(255),
  department_code VARCHAR(20),

  -- Financial fields
  orig_contract_amount DECIMAL(15,2),
  contract_amount DECIMAL(15,2),
  billed_amount DECIMAL(15,2),
  received_amount DECIMAL(15,2),
  backlog DECIMAL(15,2),
  projected_revenue DECIMAL(15,2),
  gross_profit_percent DECIMAL(8,4),
  earned_revenue DECIMAL(15,2),
  actual_cost DECIMAL(15,2),
  projected_cost DECIMAL(15,2),

  -- Labor tracking
  pf_hours_estimate DECIMAL(10,2),
  pf_hours_jtd DECIMAL(10,2),
  sm_hours_estimate DECIMAL(10,2),
  sm_hours_jtd DECIMAL(10,2),
  total_hours_estimate DECIMAL(10,2),
  total_hours_jtd DECIMAL(10,2),

  -- Location/Customer
  customer_number VARCHAR(50),
  customer_name VARCHAR(255),
  ship_city VARCHAR(100),
  ship_state VARCHAR(50),
  ship_zip VARCHAR(20),

  -- Additional metadata
  primary_market VARCHAR(100),
  negotiated_work VARCHAR(50),
  delivery_method VARCHAR(100),

  -- All Vista fields stored as JSONB for flexibility
  raw_data JSONB,

  -- Linking fields (null until linked)
  linked_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  linked_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  linked_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  linked_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,

  -- Link status and audit
  link_status VARCHAR(20) DEFAULT 'unmatched' CHECK (link_status IN ('unmatched', 'auto_matched', 'manual_matched', 'ignored')),
  link_confidence DECIMAL(3,2),
  linked_at TIMESTAMP,
  linked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Import tracking
  import_batch_id INTEGER REFERENCES vp_import_batches(id) ON DELETE SET NULL,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tenant_id, contract_number)
);

-- VP Work Orders table (from TGPBI_SMWorkOrderStatus)
CREATE TABLE IF NOT EXISTS vp_work_orders (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Vista ERP core fields
  work_order_number VARCHAR(50) NOT NULL,
  description TEXT,
  entered_date TIMESTAMP,
  requested_date DATE,
  status VARCHAR(50),
  employee_number VARCHAR(10),
  project_manager_name VARCHAR(255),
  department_code VARCHAR(20),
  negotiated_work VARCHAR(50),

  -- Financial fields
  contract_amount DECIMAL(15,2),
  actual_cost DECIMAL(15,2),
  billed_amount DECIMAL(15,2),
  received_amount DECIMAL(15,2),
  backlog DECIMAL(15,2),
  gross_profit_percent DECIMAL(8,4),

  -- Labor tracking
  pf_hours_jtd DECIMAL(10,2),
  sm_hours_jtd DECIMAL(10,2),
  mep_jtd DECIMAL(15,2),
  material_jtd DECIMAL(15,2),
  subcontracts_jtd DECIMAL(15,2),
  rentals_jtd DECIMAL(15,2),

  -- Location/Customer
  customer_name VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  primary_market VARCHAR(100),

  -- All Vista fields stored as JSONB for flexibility
  raw_data JSONB,

  -- Linking fields (null until linked)
  linked_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  linked_customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  linked_department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,

  -- Link status and audit
  link_status VARCHAR(20) DEFAULT 'unmatched' CHECK (link_status IN ('unmatched', 'auto_matched', 'manual_matched', 'ignored')),
  link_confidence DECIMAL(3,2),
  linked_at TIMESTAMP,
  linked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

  -- Import tracking
  import_batch_id INTEGER REFERENCES vp_import_batches(id) ON DELETE SET NULL,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tenant_id, work_order_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vp_contracts_tenant ON vp_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vp_contracts_status ON vp_contracts(link_status);
CREATE INDEX IF NOT EXISTS idx_vp_contracts_employee ON vp_contracts(employee_number);
CREATE INDEX IF NOT EXISTS idx_vp_contracts_customer ON vp_contracts(customer_name);
CREATE INDEX IF NOT EXISTS idx_vp_contracts_linked_project ON vp_contracts(linked_project_id);
CREATE INDEX IF NOT EXISTS idx_vp_contracts_linked_customer ON vp_contracts(linked_customer_id);
CREATE INDEX IF NOT EXISTS idx_vp_contracts_linked_employee ON vp_contracts(linked_employee_id);

CREATE INDEX IF NOT EXISTS idx_vp_work_orders_tenant ON vp_work_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vp_work_orders_status ON vp_work_orders(link_status);
CREATE INDEX IF NOT EXISTS idx_vp_work_orders_employee ON vp_work_orders(employee_number);
CREATE INDEX IF NOT EXISTS idx_vp_work_orders_customer ON vp_work_orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_vp_work_orders_linked_customer ON vp_work_orders(linked_customer_id);
CREATE INDEX IF NOT EXISTS idx_vp_work_orders_linked_employee ON vp_work_orders(linked_employee_id);

CREATE INDEX IF NOT EXISTS idx_vp_import_batches_tenant ON vp_import_batches(tenant_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_vp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vp_contracts_updated_at
  BEFORE UPDATE ON vp_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_vp_updated_at();

CREATE TRIGGER vp_work_orders_updated_at
  BEFORE UPDATE ON vp_work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_vp_updated_at();
