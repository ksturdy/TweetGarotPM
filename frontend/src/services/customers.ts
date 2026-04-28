import api from './api';
import { favoritesService } from './favorites';

export interface Customer {
  id: number;
  name: string;
  customer_number?: string;
  account_manager?: string;
  field_leads?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  controls?: string;
  department?: string;
  market?: string;
  customer_score?: number;
  active_customer: boolean;
  notes?: string;
  source?: 'vista' | 'manual';
  customer_type?: 'customer' | 'prospect';
  vp_customer_id?: number;
  // Deprecated — kept for backward compat during transition
  customer_facility?: string;
  customer_owner?: string;
  // Runtime
  isFavorited?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerLocation {
  id: number;
  customer_id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerContact {
  id: number;
  customer_id: number | null;
  tenant_id: number;
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  is_primary: boolean;
  notes?: string;
  reports_to?: number | null;
  location_id?: number | null;
  manager_name?: string;
  direct_reports_count?: number;
  location_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerStats {
  total_customers: string;
  active_customers: string;
  account_managers: string;
  states_covered: string;
}

export const customersApi = {
  async getAll() {
    const response = await api.get<Customer[]>('/customers');
    return response.data;
  },

  async getById(id: number) {
    const response = await api.get<Customer>(`/customers/${id}`);
    return response.data;
  },

  async search(query: string) {
    const response = await api.get<Customer[]>('/customers/search', {
      params: { q: query }
    });
    return response.data;
  },

  async getStats() {
    const response = await api.get<CustomerStats>('/customers/stats');
    return response.data;
  },

  async create(data: Partial<Customer>) {
    const response = await api.post<Customer>('/customers', data);
    return response.data;
  },

  async update(id: number, data: Partial<Customer>) {
    const response = await api.put<Customer>(`/customers/${id}`, data);
    return response.data;
  },

  async delete(id: number) {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },

  async toggleFavorite(id: number) {
    return favoritesService.toggle('customer', id);
  },

  async quickCreate(name: string) {
    const response = await api.post<Customer>('/customers/quick', { name });
    return response.data;
  },

  async checkMatch(name: string) {
    const response = await api.get<Customer[]>('/customers/match', { params: { name } });
    return response.data;
  },

  async merge(prospectId: number, targetCustomerId: number) {
    const response = await api.post<Customer>(`/customers/${prospectId}/merge`, {
      target_customer_id: targetCustomerId
    });
    return response.data;
  }
};

// ── Location API ──
export const getCustomerLocations = async (customerId: number | string) => {
  const response = await api.get<CustomerLocation[]>(`/customers/${customerId}/locations`);
  return response.data;
};

export const createCustomerLocation = async (customerId: number | string, data: { name: string; address?: string; city?: string; state?: string; zip_code?: string; notes?: string }) => {
  const response = await api.post<CustomerLocation>(`/customers/${customerId}/locations`, data);
  return response.data;
};

export const updateCustomerLocation = async (locationId: number, data: { name: string; address?: string; city?: string; state?: string; zip_code?: string; notes?: string }) => {
  const response = await api.put<CustomerLocation>(`/customers/locations/${locationId}`, data);
  return response.data;
};

export const deleteCustomerLocation = async (locationId: number) => {
  const response = await api.delete(`/customers/locations/${locationId}`);
  return response.data;
};

// ── Contact API ──
export const createCustomerContact = async (customerId: number | string, data: Partial<CustomerContact>) => {
  const response = await api.post<CustomerContact>(`/customers/${customerId}/contacts`, data);
  return response.data;
};

export const updateCustomerContact = async (contactId: number, data: Partial<CustomerContact>) => {
  const response = await api.put<CustomerContact>(`/customers/contacts/${contactId}`, data);
  return response.data;
};

export const getCustomerContactsHierarchy = async (customerId: number | string) => {
  const response = await api.get<CustomerContact[]>(`/customers/${customerId}/contacts/hierarchy`);
  return response.data;
};

export const getContactDirectReports = async (contactId: number) => {
  const response = await api.get<CustomerContact[]>(`/customers/contacts/${contactId}/reports`);
  return response.data;
};

// Additional convenience functions
export const getCustomer = (id: string) => customersApi.getById(parseInt(id));
export const getCustomerMetrics = async (id: string) => {
  const response = await api.get(`/customers/${id}/metrics`);
  return response.data;
};
export const getCustomerProjects = async (id: string) => {
  const response = await api.get(`/customers/${id}/projects`);
  return response.data;
};
export const getCustomerBids = async (id: string) => {
  const response = await api.get(`/customers/${id}/bids`);
  return response.data;
};
export const getCustomerTouchpoints = async (id: string) => {
  const response = await api.get(`/customers/${id}/touchpoints`);
  return response.data;
};
export const getCustomerOpportunities = async (id: string) => {
  const response = await api.get(`/customers/${id}/opportunities`);
  return response.data;
};
export const getCompanyMetrics = async (id: string) => {
  const response = await api.get(`/customers/${id}/company-metrics`);
  return response.data;
};
export const getCustomerWorkOrders = async (id: string) => {
  const response = await api.get(`/customers/${id}/work-orders`);
  return response.data;
};
export const getCustomerContacts = async (id: string) => {
  const response = await api.get(`/customers/${id}/contacts`);
  return response.data;
};
// Backward compat aliases — these now call the same endpoints as facility-level
export const getCompanyProjects = async (id: string) => {
  const response = await api.get(`/customers/${id}/company-projects`);
  return response.data;
};
export const getCompanyBids = async (id: string) => {
  const response = await api.get(`/customers/${id}/company-bids`);
  return response.data;
};
export const getCompanyOpportunities = async (id: string) => {
  const response = await api.get(`/customers/${id}/opportunities`);
  return response.data;
};
