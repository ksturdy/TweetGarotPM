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
  vp_customer_id?: number;
  // Deprecated — kept for backward compat during transition
  customer_facility?: string;
  customer_owner?: string;
  // Runtime
  isFavorited?: boolean;
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
  }
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
