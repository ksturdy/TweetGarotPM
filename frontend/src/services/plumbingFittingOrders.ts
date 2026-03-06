import api from './api';

export interface PlumbingFittingOrderItem {
  id: number;
  fitting_order_id: number;
  sort_order: number;
  fitting_type: string;
  size: string;
  join_type: string;
  quantity: number;
  remarks: string;
}

export interface PlumbingFittingOrder {
  id: number;
  project_id: number;
  tenant_id: number;
  number: number;
  title: string;
  description: string;
  priority: string;
  required_by_date: string | null;
  drawing_number: string;
  drawing_revision: string;
  spec_section: string;
  location_on_site: string;
  material_type: string;
  pipe_size: string;
  fixture_type: string;
  rough_in_dimensions: string;
  quantity: number;
  unit: string;
  status: string;
  shop_received_date: string | null;
  shop_assigned_to: string;
  fabrication_start_date: string | null;
  fabrication_complete_date: string | null;
  delivery_date: string | null;
  cost_code: string;
  phase_code: string;
  notes: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  items?: PlumbingFittingOrderItem[];
}

export interface PlumbingFittingOrderStats {
  total_count: number;
  draft_count: number;
  submitted_count: number;
  in_fabrication_count: number;
  ready_count: number;
  delivered_count: number;
  installed_count: number;
}

export const plumbingFittingOrdersApi = {
  getByProject: (projectId: number, filters?: { status?: string; priority?: string }) =>
    api.get<PlumbingFittingOrder[]>(`/plumbing-fitting-orders/project/${projectId}`, { params: filters }),

  getStats: (projectId: number) =>
    api.get<PlumbingFittingOrderStats>(`/plumbing-fitting-orders/project/${projectId}/stats`),

  getById: (id: number) => api.get<PlumbingFittingOrder>(`/plumbing-fitting-orders/${id}`),

  create: (data: Partial<PlumbingFittingOrder>) => api.post<PlumbingFittingOrder>('/plumbing-fitting-orders', data),

  update: (id: number, data: Partial<PlumbingFittingOrder>) =>
    api.put<PlumbingFittingOrder>(`/plumbing-fitting-orders/${id}`, data),

  submit: (id: number) => api.post<PlumbingFittingOrder>(`/plumbing-fitting-orders/${id}/submit`),

  updateStatus: (id: number, data: Partial<PlumbingFittingOrder>) =>
    api.post<PlumbingFittingOrder>(`/plumbing-fitting-orders/${id}/update-status`, data),

  delete: (id: number) => api.delete(`/plumbing-fitting-orders/${id}`),

  // Line item methods
  addItem: (orderId: number, data: Partial<PlumbingFittingOrderItem>) =>
    api.post<PlumbingFittingOrderItem>(`/plumbing-fitting-orders/${orderId}/items`, data),

  updateItem: (orderId: number, itemId: number, data: Partial<PlumbingFittingOrderItem>) =>
    api.put<PlumbingFittingOrderItem>(`/plumbing-fitting-orders/${orderId}/items/${itemId}`, data),

  deleteItem: (orderId: number, itemId: number) =>
    api.delete(`/plumbing-fitting-orders/${orderId}/items/${itemId}`),
};
