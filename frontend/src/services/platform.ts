import api from './api';

export interface PlatformStats {
  total_tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  new_tenants_30d: number;
  total_active_users: number;
  total_users: number;
  total_projects: number;
  total_customers: number;
  total_opportunities: number;
}

export interface PlanStats {
  plan_name: string;
  display_name: string;
  price_monthly: number;
  tenant_count: number;
  monthly_revenue: number;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  email: string;
  phone: string;
  status: string;
  plan_id: number;
  plan_name: string;
  plan_display_name: string;
  active_users: number;
  total_users: number;
  project_count: number;
  customer_count: number;
  opportunity_count: number;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
}

export interface TenantDetails extends Tenant {
  address: string;
  city: string;
  state: string;
  zip_code: string;
  website: string;
  settings: object;
  plan_limits: object;
  plan_features: object;
  price_monthly: number;
  price_yearly: number;
  company_count: number;
  employee_count: number;
  primary_admin_email: string;
}

export interface Plan {
  id: number;
  name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  limits: object;
  features: object;
}

export interface AuditLogEntry {
  id: number;
  admin_user_id: number;
  admin_email: string;
  admin_name: string;
  action: string;
  target_type: string;
  target_id: number;
  details: object;
  ip_address: string;
  created_at: string;
}

// Stats
export const getPlatformStats = async (): Promise<PlatformStats> => {
  const response = await api.get('/platform/stats');
  return response.data;
};

export const getPlanStats = async (): Promise<PlanStats[]> => {
  const response = await api.get('/platform/stats/plans');
  return response.data;
};

// Tenants
export const getTenants = async (params?: {
  status?: string;
  search?: string;
  sortBy?: string;
  order?: string;
  limit?: number;
  offset?: number;
}): Promise<{ tenants: Tenant[]; total: number }> => {
  const response = await api.get('/platform/tenants', { params });
  return response.data;
};

export const getTenantDetails = async (id: number): Promise<TenantDetails> => {
  const response = await api.get(`/platform/tenants/${id}`);
  return response.data;
};

export const updateTenant = async (id: number, data: Partial<Tenant>): Promise<Tenant> => {
  const response = await api.put(`/platform/tenants/${id}`, data);
  return response.data;
};

export const suspendTenant = async (id: number, reason: string): Promise<{ message: string; tenant: Tenant }> => {
  const response = await api.post(`/platform/tenants/${id}/suspend`, { reason });
  return response.data;
};

export const activateTenant = async (id: number): Promise<{ message: string; tenant: Tenant }> => {
  const response = await api.post(`/platform/tenants/${id}/activate`);
  return response.data;
};

export const changeTenantPlan = async (id: number, planId: number): Promise<{ message: string; tenant: Tenant }> => {
  const response = await api.post(`/platform/tenants/${id}/plan`, { planId });
  return response.data;
};

export const deleteTenant = async (id: number, confirmSlug: string): Promise<{ message: string }> => {
  const response = await api.delete(`/platform/tenants/${id}`, { data: { confirm: confirmSlug } });
  return response.data;
};

// Users
export const getPlatformUsers = async (params?: {
  search?: string;
  tenantId?: number;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<any[]> => {
  const response = await api.get('/platform/users', { params });
  return response.data;
};

// Plans
export const getPlans = async (): Promise<Plan[]> => {
  const response = await api.get('/platform/plans');
  return response.data;
};

export const createPlan = async (data: Omit<Plan, 'id'>): Promise<Plan> => {
  const response = await api.post('/platform/plans', data);
  return response.data;
};

export const updatePlan = async (id: number, data: Partial<Plan>): Promise<Plan> => {
  const response = await api.put(`/platform/plans/${id}`, data);
  return response.data;
};

// Audit Log
export const getAuditLog = async (params?: {
  action?: string;
  adminUserId?: number;
  limit?: number;
  offset?: number;
}): Promise<AuditLogEntry[]> => {
  const response = await api.get('/platform/audit-log', { params });
  return response.data;
};
