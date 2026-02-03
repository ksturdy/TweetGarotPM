import api from './api';

// ==================== INTERFACES ====================

export interface VPContract {
  id: number;
  tenant_id: number;
  contract_number: string;
  description: string | null;
  status: string | null;
  employee_number: string | null;
  project_manager_name: string | null;
  department_code: string | null;
  orig_contract_amount: number | null;
  contract_amount: number | null;
  billed_amount: number | null;
  received_amount: number | null;
  backlog: number | null;
  projected_revenue: number | null;
  gross_profit_percent: number | null;
  earned_revenue: number | null;
  actual_cost: number | null;
  projected_cost: number | null;
  pf_hours_estimate: number | null;
  pf_hours_jtd: number | null;
  sm_hours_estimate: number | null;
  sm_hours_jtd: number | null;
  total_hours_estimate: number | null;
  total_hours_jtd: number | null;
  customer_number: string | null;
  customer_name: string | null;
  ship_city: string | null;
  ship_state: string | null;
  ship_zip: string | null;
  primary_market: string | null;
  negotiated_work: string | null;
  delivery_method: string | null;
  raw_data: Record<string, unknown> | null;
  linked_project_id: number | null;
  linked_employee_id: number | null;
  linked_customer_id: number | null;
  linked_department_id: number | null;
  link_status: 'unmatched' | 'auto_matched' | 'manual_matched' | 'ignored';
  link_confidence: number | null;
  linked_at: string | null;
  linked_by: number | null;
  import_batch_id: number | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  linked_project_name?: string;
  linked_project_number?: string;
  linked_employee_name?: string;
  linked_customer_facility?: string;
  linked_customer_owner?: string;
  linked_department_name?: string;
}

export interface VPWorkOrder {
  id: number;
  tenant_id: number;
  work_order_number: string;
  description: string | null;
  entered_date: string | null;
  requested_date: string | null;
  status: string | null;
  employee_number: string | null;
  project_manager_name: string | null;
  department_code: string | null;
  negotiated_work: string | null;
  contract_amount: number | null;
  actual_cost: number | null;
  billed_amount: number | null;
  received_amount: number | null;
  backlog: number | null;
  gross_profit_percent: number | null;
  pf_hours_jtd: number | null;
  sm_hours_jtd: number | null;
  mep_jtd: number | null;
  material_jtd: number | null;
  subcontracts_jtd: number | null;
  rentals_jtd: number | null;
  customer_name: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  primary_market: string | null;
  raw_data: Record<string, unknown> | null;
  linked_employee_id: number | null;
  linked_customer_id: number | null;
  linked_department_id: number | null;
  link_status: 'unmatched' | 'auto_matched' | 'manual_matched' | 'ignored';
  link_confidence: number | null;
  linked_at: string | null;
  linked_by: number | null;
  import_batch_id: number | null;
  imported_at: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  linked_employee_name?: string;
  linked_customer_facility?: string;
  linked_customer_owner?: string;
  linked_department_name?: string;
}

export interface VPImportBatch {
  id: number;
  tenant_id: number;
  file_name: string;
  file_type: 'contracts' | 'work_orders' | 'employees' | 'customers' | 'vendors';
  records_total: number;
  records_new: number;
  records_updated: number;
  records_auto_matched: number;
  imported_by: number;
  imported_at: string;
  imported_by_name?: string;
}

export interface VPStats {
  total_contracts: number;
  unmatched_contracts: number;
  matched_contracts: number;
  total_work_orders: number;
  unmatched_work_orders: number;
  matched_work_orders: number;
  total_employees: number;
  active_employees: number;
  total_customers: number;
  active_customers: number;
  total_vendors: number;
  active_vendors: number;
  last_contracts_import: string | null;
  last_work_orders_import: string | null;
  last_employees_import: string | null;
  last_customers_import: string | null;
  last_vendors_import: string | null;
}

export interface VPFilters {
  link_status?: string;
  search?: string;
  status?: string;
  limit?: number;
}

export interface ImportResult {
  message: string;
  contracts: { total: number; new: number; updated: number; batch_id: number | null };
  workOrders: { total: number; new: number; updated: number; batch_id: number | null };
  employees: { total: number; new: number; updated: number; batch_id: number | null };
  customers: { total: number; new: number; updated: number; batch_id: number | null };
  vendors: { total: number; new: number; updated: number; batch_id: number | null };
  sheetsFound: string[];
  sheetsProcessed: string[];
}

export interface AutoMatchResult {
  message: string;
  contracts: { matched: number; total: number };
  workOrders: { matched: number; total: number };
}

export interface LinkData {
  project_id?: number;
  employee_id?: number;
  customer_id?: number;
  department_id?: number;
}

export interface CustomerVistaData {
  contracts: VPContract[];
  workOrders: VPWorkOrder[];
  contractTotals: {
    total_contract_amount: number;
    total_backlog: number;
    count: number;
  };
  workOrderTotals: {
    total_contract_amount: number;
    total_backlog: number;
    count: number;
  };
}

export interface EmployeeVistaData {
  contracts: VPContract[];
  workOrders: VPWorkOrder[];
}

// VP Reference Data Interfaces
export interface VPEmployee {
  id: number;
  employee_number: number;
  first_name: string | null;
  last_name: string | null;
  hire_date: string | null;
  active: boolean;
  linked_employee_id: number | null;
  link_status: 'unmatched' | 'auto_matched' | 'manual_matched' | 'ignored';
  linked_at: string | null;
  linked_by: number | null;
  raw_data: Record<string, unknown> | null;
  import_batch_id: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  linked_employee_name?: string;
  linked_employee_number?: string;
}

export interface VPCustomer {
  id: number;
  customer_number: number;
  name: string | null;
  address: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  active: boolean;
  linked_customer_id: number | null;
  link_status: 'unmatched' | 'auto_matched' | 'manual_matched' | 'ignored';
  linked_at: string | null;
  linked_by: number | null;
  raw_data: Record<string, unknown> | null;
  import_batch_id: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  linked_customer_owner?: string;
  linked_customer_facility?: string;
}

export interface VPVendor {
  id: number;
  vendor_number: number;
  name: string | null;
  address: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  active: boolean;
  linked_vendor_id: number | null;
  link_status: 'unmatched' | 'auto_matched' | 'manual_matched' | 'ignored';
  linked_at: string | null;
  linked_by: number | null;
  raw_data: Record<string, unknown> | null;
  import_batch_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface VPRefFilters {
  link_status?: string;
  search?: string;
  active?: boolean;
  limit?: number;
}

// Duplicates Report Interfaces
export interface EmployeeMatch {
  titan_id: number;
  titan_employee_number: string | null;
  titan_name: string;
  similarity: number;
  last_name_match: boolean;
}

export interface EmployeeDuplicate {
  vp_id: number;
  vp_employee_number: number;
  vp_name: string;
  vp_active: boolean;
  potential_matches: EmployeeMatch[];
}

export interface CustomerMatch {
  titan_id: number;
  titan_owner: string | null;
  titan_facility: string | null;
  titan_location: string;
  similarity: number;
  matched_on: 'owner' | 'facility';
  location_match: boolean;
}

export interface CustomerDuplicate {
  vp_id: number;
  vp_customer_number: number;
  vp_name: string;
  vp_location: string;
  vp_active: boolean;
  potential_matches: CustomerMatch[];
}

export interface DuplicatesStats {
  employees: {
    total_unlinked: number;
    with_high_confidence: number;
    with_medium_confidence: number;
    with_low_confidence: number;
  };
  customers: {
    total_unlinked: number;
    with_high_confidence: number;
    with_medium_confidence: number;
    with_low_confidence: number;
  };
}

// Contract Duplicates
export interface ContractMatch {
  titan_id: number;
  titan_number: string | null;
  titan_name: string | null;
  titan_customer: string | null;
  similarity: number;
  exact_number_match: boolean;
}

export interface ContractDuplicate {
  vp_id: number;
  vp_contract_number: string;
  vp_description: string | null;
  vp_customer: string | null;
  vp_amount: number | null;
  vp_status: string | null;
  potential_matches: ContractMatch[];
}

// Department Duplicates
export interface DepartmentMatch {
  titan_id: number;
  titan_number: string | null;
  titan_name: string | null;
  similarity: number;
  exact_match: boolean;
}

export interface DepartmentDuplicate {
  vp_department_code: string;
  usage_count: {
    contracts: number;
    work_orders: number;
  };
  potential_matches: DepartmentMatch[];
}

// Vendor Duplicates
export interface VendorMatch {
  titan_id: number;
  titan_vendor_name: string | null;
  titan_company_name: string | null;
  titan_location: string;
  similarity: number;
  matched_on: 'vendor_name' | 'company_name';
  location_match: boolean;
}

export interface VendorDuplicate {
  vp_id: number;
  vp_vendor_number: number;
  vp_name: string;
  vp_location: string;
  vp_active: boolean;
  potential_matches: VendorMatch[];
}

export interface ImportToTitanResult {
  message: string;
  imported: number;
  total: number;
  results: Array<{
    vp_id: number;
    titan_id: number;
    name: string;
  }>;
}

export interface LinkDepartmentCodeResult {
  message: string;
  department_code: string;
  department_id: number;
  contracts_updated: number;
  work_orders_updated: number;
  total_updated: number;
}

export interface AutoLinkDepartmentsResult {
  message: string;
  codes_linked: number;
  contracts_updated: number;
  work_orders_updated: number;
  total_updated: number;
  details: Array<{
    department_code: string;
    titan_department_id: number;
    titan_department_name: string;
    contracts_updated: number;
    work_orders_updated: number;
  }>;
}

// ==================== SERVICE ====================

export const vistaDataService = {
  // ==================== STATS ====================

  getStats: async (): Promise<VPStats> => {
    const response = await api.get('/vista/stats');
    return response.data;
  },

  // ==================== IMPORT ====================

  getImportHistory: async (): Promise<VPImportBatch[]> => {
    const response = await api.get('/vista/import/history');
    return response.data;
  },

  uploadVistaData: async (file: File): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/vista/import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  triggerAutoMatch: async (): Promise<AutoMatchResult> => {
    const response = await api.post('/vista/import/auto-match');
    return response.data;
  },

  // ==================== CONTRACTS ====================

  getAllContracts: async (filters?: VPFilters): Promise<VPContract[]> => {
    const params = new URLSearchParams();
    if (filters?.link_status) params.append('link_status', filters.link_status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = queryString ? `/vista/contracts?${queryString}` : '/vista/contracts';
    const response = await api.get(url);
    return response.data;
  },

  getUnmatchedContracts: async (): Promise<VPContract[]> => {
    const response = await api.get('/vista/contracts/unmatched');
    return response.data;
  },

  getContractById: async (id: number): Promise<VPContract> => {
    const response = await api.get(`/vista/contracts/${id}`);
    return response.data;
  },

  linkContract: async (id: number, linkData: LinkData): Promise<VPContract> => {
    const response = await api.post(`/vista/contracts/${id}/link`, linkData);
    return response.data;
  },

  unlinkContract: async (id: number): Promise<VPContract> => {
    const response = await api.delete(`/vista/contracts/${id}/link`);
    return response.data;
  },

  ignoreContract: async (id: number): Promise<VPContract> => {
    const response = await api.post(`/vista/contracts/${id}/ignore`);
    return response.data;
  },

  // ==================== WORK ORDERS ====================

  getAllWorkOrders: async (filters?: VPFilters): Promise<VPWorkOrder[]> => {
    const params = new URLSearchParams();
    if (filters?.link_status) params.append('link_status', filters.link_status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = queryString ? `/vista/work-orders?${queryString}` : '/vista/work-orders';
    const response = await api.get(url);
    return response.data;
  },

  getUnmatchedWorkOrders: async (): Promise<VPWorkOrder[]> => {
    const response = await api.get('/vista/work-orders/unmatched');
    return response.data;
  },

  getWorkOrderById: async (id: number): Promise<VPWorkOrder> => {
    const response = await api.get(`/vista/work-orders/${id}`);
    return response.data;
  },

  linkWorkOrder: async (id: number, linkData: LinkData): Promise<VPWorkOrder> => {
    const response = await api.post(`/vista/work-orders/${id}/link`, linkData);
    return response.data;
  },

  unlinkWorkOrder: async (id: number): Promise<VPWorkOrder> => {
    const response = await api.delete(`/vista/work-orders/${id}/link`);
    return response.data;
  },

  ignoreWorkOrder: async (id: number): Promise<VPWorkOrder> => {
    const response = await api.post(`/vista/work-orders/${id}/ignore`);
    return response.data;
  },

  // ==================== ENTITY AGGREGATIONS ====================

  getCustomerVistaData: async (customerId: number): Promise<CustomerVistaData> => {
    const response = await api.get(`/vista/customer/${customerId}`);
    return response.data;
  },

  getProjectVistaData: async (projectId: number): Promise<VPContract | null> => {
    const response = await api.get(`/vista/project/${projectId}`);
    return response.data;
  },

  getEmployeeVistaData: async (employeeId: number): Promise<EmployeeVistaData> => {
    const response = await api.get(`/vista/employee/${employeeId}`);
    return response.data;
  },

  // ==================== VP EMPLOYEES (Reference Data) ====================

  getAllVPEmployees: async (filters?: VPRefFilters): Promise<VPEmployee[]> => {
    const params = new URLSearchParams();
    if (filters?.link_status) params.append('link_status', filters.link_status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.active !== undefined) params.append('active', String(filters.active));
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = queryString ? `/vista/vp-employees?${queryString}` : '/vista/vp-employees';
    const response = await api.get(url);
    return response.data;
  },

  linkVPEmployee: async (id: number, employeeId: number): Promise<VPEmployee> => {
    const response = await api.post(`/vista/vp-employees/${id}/link`, { employee_id: employeeId });
    return response.data;
  },

  unlinkVPEmployee: async (id: number): Promise<VPEmployee> => {
    const response = await api.delete(`/vista/vp-employees/${id}/link`);
    return response.data;
  },

  // ==================== VP CUSTOMERS (Reference Data) ====================

  getAllVPCustomers: async (filters?: VPRefFilters): Promise<VPCustomer[]> => {
    const params = new URLSearchParams();
    if (filters?.link_status) params.append('link_status', filters.link_status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.active !== undefined) params.append('active', String(filters.active));
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = queryString ? `/vista/vp-customers?${queryString}` : '/vista/vp-customers';
    const response = await api.get(url);
    return response.data;
  },

  linkVPCustomer: async (id: number, customerId: number): Promise<VPCustomer> => {
    const response = await api.post(`/vista/vp-customers/${id}/link`, { customer_id: customerId });
    return response.data;
  },

  unlinkVPCustomer: async (id: number): Promise<VPCustomer> => {
    const response = await api.delete(`/vista/vp-customers/${id}/link`);
    return response.data;
  },

  // ==================== VP VENDORS (Reference Data) ====================

  getAllVPVendors: async (filters?: VPRefFilters): Promise<VPVendor[]> => {
    const params = new URLSearchParams();
    if (filters?.link_status) params.append('link_status', filters.link_status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.active !== undefined) params.append('active', String(filters.active));
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const url = queryString ? `/vista/vp-vendors?${queryString}` : '/vista/vp-vendors';
    const response = await api.get(url);
    return response.data;
  },

  linkVPVendor: async (id: number, vendorId: number): Promise<VPVendor> => {
    const response = await api.post(`/vista/vp-vendors/${id}/link`, { vendor_id: vendorId });
    return response.data;
  },

  unlinkVPVendor: async (id: number): Promise<VPVendor> => {
    const response = await api.delete(`/vista/vp-vendors/${id}/link`);
    return response.data;
  },

  // ==================== DUPLICATES / SIMILARITY REPORT ====================

  getDuplicatesStats: async (): Promise<DuplicatesStats> => {
    const response = await api.get('/vista/duplicates/stats');
    return response.data;
  },

  getEmployeeDuplicates: async (minSimilarity?: number): Promise<EmployeeDuplicate[]> => {
    const params = new URLSearchParams();
    if (minSimilarity !== undefined) params.append('min_similarity', minSimilarity.toString());

    const queryString = params.toString();
    const url = queryString ? `/vista/duplicates/employees?${queryString}` : '/vista/duplicates/employees';
    const response = await api.get(url);
    return response.data;
  },

  getCustomerDuplicates: async (minSimilarity?: number): Promise<CustomerDuplicate[]> => {
    const params = new URLSearchParams();
    if (minSimilarity !== undefined) params.append('min_similarity', minSimilarity.toString());

    const queryString = params.toString();
    const url = queryString ? `/vista/duplicates/customers?${queryString}` : '/vista/duplicates/customers';
    const response = await api.get(url);
    return response.data;
  },

  // ==================== IMPORT UNMATCHED TO TITAN ====================

  importUnmatchedEmployeesToTitan: async (): Promise<ImportToTitanResult> => {
    const response = await api.post('/vista/import-to-titan/employees');
    return response.data;
  },

  importUnmatchedCustomersToTitan: async (): Promise<ImportToTitanResult> => {
    const response = await api.post('/vista/import-to-titan/customers');
    return response.data;
  },

  importUnmatchedVendorsToTitan: async (): Promise<ImportToTitanResult> => {
    const response = await api.post('/vista/import-to-titan/vendors');
    return response.data;
  },

  importUnmatchedContractsToTitan: async (): Promise<ImportToTitanResult> => {
    const response = await api.post('/vista/import-to-titan/contracts');
    return response.data;
  },

  importUnmatchedDepartmentsToTitan: async (): Promise<ImportToTitanResult> => {
    const response = await api.post('/vista/import-to-titan/departments');
    return response.data;
  },

  // ==================== NEW DUPLICATES ENDPOINTS ====================

  getContractDuplicates: async (minSimilarity?: number): Promise<ContractDuplicate[]> => {
    const params = new URLSearchParams();
    if (minSimilarity !== undefined) params.append('min_similarity', minSimilarity.toString());

    const queryString = params.toString();
    const url = queryString ? `/vista/duplicates/contracts?${queryString}` : '/vista/duplicates/contracts';
    const response = await api.get(url);
    return response.data;
  },

  getDepartmentDuplicates: async (minSimilarity?: number): Promise<DepartmentDuplicate[]> => {
    const params = new URLSearchParams();
    if (minSimilarity !== undefined) params.append('min_similarity', minSimilarity.toString());

    const queryString = params.toString();
    const url = queryString ? `/vista/duplicates/departments?${queryString}` : '/vista/duplicates/departments';
    const response = await api.get(url);
    return response.data;
  },

  getVendorDuplicates: async (minSimilarity?: number): Promise<VendorDuplicate[]> => {
    const params = new URLSearchParams();
    if (minSimilarity !== undefined) params.append('min_similarity', minSimilarity.toString());

    const queryString = params.toString();
    const url = queryString ? `/vista/duplicates/vendors?${queryString}` : '/vista/duplicates/vendors';
    const response = await api.get(url);
    return response.data;
  },

  // Link a VP department code to a Titan department (updates all contracts/work orders with that code)
  linkDepartmentCode: async (departmentCode: string, departmentId: number): Promise<LinkDepartmentCodeResult> => {
    const response = await api.post('/vista/link-department-code', {
      department_code: departmentCode,
      department_id: departmentId,
    });
    return response.data;
  },

  // Auto-link all department codes that have exact matches to Titan departments
  autoLinkExactDepartmentMatches: async (): Promise<AutoLinkDepartmentsResult> => {
    const response = await api.post('/vista/auto-link-departments');
    return response.data;
  },
};
