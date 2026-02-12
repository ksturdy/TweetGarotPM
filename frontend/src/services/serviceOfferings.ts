import api from './api';

export interface ServiceOffering {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  category?: string;
  pricing_model?: string;
  typical_duration_days?: number;
  icon_name?: string;
  display_order?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceOfferingFilters {
  category?: string;
  is_active?: boolean;
}

export const serviceOfferingsApi = {
  /**
   * Get all service offerings with optional filters
   */
  getAll: (filters?: ServiceOfferingFilters) =>
    api.get<ServiceOffering[]>('/service-offerings', { params: filters }),

  /**
   * Get a single service offering by ID
   */
  getById: (id: number) =>
    api.get<ServiceOffering>(`/service-offerings/${id}`),

  /**
   * Create a new service offering
   */
  create: (data: Partial<ServiceOffering>) =>
    api.post<ServiceOffering>('/service-offerings', data),

  /**
   * Update a service offering
   */
  update: (id: number, data: Partial<ServiceOffering>) =>
    api.put<ServiceOffering>(`/service-offerings/${id}`, data),

  /**
   * Delete a service offering
   */
  delete: (id: number) =>
    api.delete(`/service-offerings/${id}`),

  /**
   * Reorder service offerings
   */
  reorder: (updates: Array<{ id: number; display_order: number }>) =>
    api.post('/service-offerings/reorder', { updates }),

  /**
   * Get list of categories
   */
  getCategories: () =>
    api.get<string[]>('/service-offerings/categories'),
};
