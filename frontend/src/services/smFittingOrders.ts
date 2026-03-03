import api from './api';

export interface SmFittingOrder {
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
  material_gauge: string;
  duct_type: string;
  dimensions: string;
  insulation_required: boolean;
  insulation_spec: string;
  liner_required: boolean;
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
}

export interface SmFittingOrderStats {
  total_count: number;
  draft_count: number;
  submitted_count: number;
  in_fabrication_count: number;
  ready_count: number;
  delivered_count: number;
  installed_count: number;
}

export const smFittingOrdersApi = {
  getByProject: (projectId: number, filters?: { status?: string; priority?: string }) =>
    api.get<SmFittingOrder[]>(`/sm-fitting-orders/project/${projectId}`, { params: filters }),

  getStats: (projectId: number) =>
    api.get<SmFittingOrderStats>(`/sm-fitting-orders/project/${projectId}/stats`),

  getById: (id: number) => api.get<SmFittingOrder>(`/sm-fitting-orders/${id}`),

  create: (data: Partial<SmFittingOrder>) => api.post<SmFittingOrder>('/sm-fitting-orders', data),

  update: (id: number, data: Partial<SmFittingOrder>) =>
    api.put<SmFittingOrder>(`/sm-fitting-orders/${id}`, data),

  submit: (id: number) => api.post<SmFittingOrder>(`/sm-fitting-orders/${id}/submit`),

  updateStatus: (id: number, data: Partial<SmFittingOrder>) =>
    api.post<SmFittingOrder>(`/sm-fitting-orders/${id}/update-status`, data),

  delete: (id: number) => api.delete(`/sm-fitting-orders/${id}`),
};
